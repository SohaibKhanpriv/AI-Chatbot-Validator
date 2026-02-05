"""Run validation: batch message_responses, call LLM per criterion with conversation context, persist validations."""
import json
import re
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import (
    Dataset,
    Run,
    MessageResponse,
    Query,
    ValidationCriterion,
    Validation,
    RunValidationBatch,
)
from app.services.prompt_hub_service import get_prompt_body, get_system_behavior_reference
from app.services.llm_client import chat_completion

VALIDATE_BATCH_PROMPT_KEY = "validate_batch"


async def get_message_responses_with_queries(
    session: AsyncSession, run_id: int
) -> list[tuple[MessageResponse, Query]]:
    result = await session.execute(
        select(MessageResponse, Query)
        .join(Query, MessageResponse.query_id == Query.id)
        .where(MessageResponse.run_id == run_id)
        .order_by(MessageResponse.id)
    )
    return [(mr, q) for mr, q in result.all()]


async def get_active_criteria(session: AsyncSession) -> list[ValidationCriterion]:
    result = await session.execute(
        select(ValidationCriterion).where(ValidationCriterion.active == True).order_by(ValidationCriterion.sort_order)
    )
    return list(result.scalars().all())


async def get_criteria_by_keys(session: AsyncSession, keys: list[str]) -> list[ValidationCriterion]:
    if not keys:
        return []
    result = await session.execute(
        select(ValidationCriterion)
        .where(ValidationCriterion.key.in_(keys))
        .order_by(ValidationCriterion.sort_order)
    )
    # Preserve order of keys as given (first occurrence)
    by_key = {c.key: c for c in result.scalars().all()}
    return [by_key[k] for k in keys if k in by_key]


def _parse_batch_response(content: str) -> list[dict]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```\w*\n?", "", content)
        content = re.sub(r"\n?```\s*$", "", content)
    data = json.loads(content)
    if not isinstance(data, list):
        return [data]
    return data


async def validate_run(session: AsyncSession, run_id: int) -> None:
    """
    For run: get message_responses (with query/expectations), active criteria;
    batch by validation_batch_size (default 10); each item includes previous_turns (last N turns) for conversation context;
    for each criterion and batch call LLM with validate_batch prompt; persist Validation rows and RunValidationBatch.
    """
    run = await session.get(Run, run_id)
    if not run:
        raise ValueError(f"Run {run_id} not found")
    if run.status != "completed":
        raise ValueError(f"Run {run_id} is not completed; cannot validate")

    pairs = await get_message_responses_with_queries(session, run_id)
    if not pairs:
        return
    config = run.config if isinstance(run.config, dict) else {}
    criterion_keys = config.get("criterion_keys")
    if criterion_keys is not None:
        criteria = await get_criteria_by_keys(session, criterion_keys)
    else:
        criteria = await get_active_criteria(session)
    if not criteria:
        return

    batch_prompt_template = await get_prompt_body(session, VALIDATE_BATCH_PROMPT_KEY)
    if not batch_prompt_template:
        raise ValueError(f"Prompt '{VALIDATE_BATCH_PROMPT_KEY}' not found. Run seed.")

    dataset = await session.get(Dataset, run.dataset_id) if run.dataset_id else None
    reference_content = get_system_behavior_reference()
    system_behavior_parts = []
    if dataset and getattr(dataset, "system_behavior", None) and dataset.system_behavior.strip():
        system_behavior_parts.append(
            f"Dataset context (use to interpret expectations and evaluate responses):\n{dataset.system_behavior.strip()}"
        )
    if reference_content:
        system_behavior_parts.append(
            f"Reference – Chat System & Prompts (for testing/validation):\n{reference_content}"
        )
    system_behavior_section = ""
    if system_behavior_parts:
        system_behavior_section = "\n\n---\n\n".join(system_behavior_parts) + "\n\n"

    settings = get_settings()
    batch_size = settings.validation_batch_size
    context_turns = settings.validation_context_turns

    def _response_payload(mr: MessageResponse) -> str | dict:
        if mr.raw_chunks and isinstance(mr.raw_chunks, dict) and "last_chunk" in mr.raw_chunks:
            return mr.raw_chunks["last_chunk"]
        return mr.response_text or ""

    for criterion in criteria:
        for batch_start in range(0, len(pairs), batch_size):
            batch_pairs = pairs[batch_start : batch_start + batch_size]
            batch_index = batch_start // batch_size
            items = []
            for i, (mr, q) in enumerate(batch_pairs):
                idx = batch_start + i
                prev_start = max(0, idx - context_turns)
                previous_turns = [
                    {"query": pairs[j][1].query_text or "", "response": _response_payload(pairs[j][0])}
                    for j in range(prev_start, idx)
                ]
                items.append({
                    "previous_turns": previous_turns,
                    "query": q.query_text,
                    "expectations": q.expectations or "",
                    "response": _response_payload(mr),
                })
            items_json = json.dumps(items, ensure_ascii=False)
            additional_info_section = ""
            if getattr(criterion, "additional_info", None) and (criterion.additional_info or "").strip():
                additional_info_section = f"Additional context for this criterion: {criterion.additional_info.strip()}\n\n"
            applies_to_all_instruction = ""
            if not getattr(criterion, "applies_to_all", True):
                applies_to_all_instruction = "If this criterion does not apply to an item (e.g. no goal string in the query), output passed: true, score: 100, reason: \"N/A - criterion not applicable\".\n\n"
            prompt_body = batch_prompt_template.replace("{system_behavior}", system_behavior_section)
            prompt_body = prompt_body.replace("{criterion_name}", criterion.name)
            prompt_body = prompt_body.replace("{criterion_description}", criterion.description or "")
            prompt_body = prompt_body.replace("{additional_info}", additional_info_section)
            prompt_body = prompt_body.replace("{applies_to_all_instruction}", applies_to_all_instruction)
            prompt_body = prompt_body.replace("{items_json}", items_json)

            try:
                content = await chat_completion(system=None, user=prompt_body)
                results = _parse_batch_response(content)
            except Exception as e:
                results = [{"passed": False, "score": 0, "reason": str(e)} for _ in batch_pairs]
            while len(results) < len(batch_pairs):
                results.append({"passed": False, "score": 0, "reason": "Missing from LLM"})
            results = results[: len(batch_pairs)]

            rvb = RunValidationBatch(
                run_id=run_id,
                batch_index=batch_index,
                status="running",
                started_at=datetime.utcnow(),
            )
            session.add(rvb)
            await session.flush()

            for (mr, _), res in zip(batch_pairs, results):
                if not isinstance(res, dict):
                    res = {"passed": False, "score": 0, "reason": "Invalid result"}
                v = Validation(
                    run_id=run_id,
                    message_response_id=mr.id,
                    criterion_key=criterion.key,
                    passed=bool(res.get("passed", False)),
                    score=float(res["score"]) if res.get("score") is not None else None,
                    details={"reason": res.get("reason")},
                )
                session.add(v)
            rvb.status = "completed"
            rvb.completed_at = datetime.utcnow()
            await session.commit()
