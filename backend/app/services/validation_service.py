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

# Placeholder in template for items; we send items in user message instead.
ITEMS_PLACEHOLDER = "Input list (JSON array): {items_json}"


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


def _build_system_content(
    batch_prompt_template: str,
    system_behavior_section: str,
    criterion: ValidationCriterion,
) -> str:
    """Build system message: system_behavior + instructions + criterion (no items)."""
    additional_info_section = ""
    if getattr(criterion, "additional_info", None) and (criterion.additional_info or "").strip():
        additional_info_section = f"Additional context for this criterion: {criterion.additional_info.strip()}\n\n"
    applies_to_all_instruction = ""
    if not getattr(criterion, "applies_to_all", True):
        applies_to_all_instruction = 'If this criterion does not apply to an item (e.g. no goal string in the query), output passed: true, score: 100, reason: "N/A - criterion not applicable".\n\n'
    full = (
        batch_prompt_template.replace("{system_behavior}", system_behavior_section)
        .replace("{criterion_name}", criterion.name)
        .replace("{criterion_description}", criterion.description or "")
        .replace("{additional_info}", additional_info_section)
        .replace("{applies_to_all_instruction}", applies_to_all_instruction)
    )
    # Replace the "Input list (JSON array): {items_json}" line so items go in user message
    if ITEMS_PLACEHOLDER in full:
        full = full.replace(
            ITEMS_PLACEHOLDER,
            "The items will be provided in the next message. Output a JSON array with one object per item, in the same order.",
        )
    else:
        full = full.replace("{items_json}", "The items will be provided in the next message.")
    return full.strip()


async def validate_run(session: AsyncSession, run_id: int) -> None:
    """
    For run: get message_responses (with query/expectations), active criteria.
    Chunk items by validation_max_items_per_request; for each criterion and each chunk,
    one LLM call with system message (context + criterion) and user message (items only).
    Persist Validation rows and RunValidationBatch per request.
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
    context_turns = settings.validation_context_turns
    max_items_per_request = settings.validation_max_items_per_request

    def _response_payload(mr: MessageResponse) -> str | dict:
        if mr.raw_chunks and isinstance(mr.raw_chunks, dict) and "last_chunk" in mr.raw_chunks:
            return mr.raw_chunks["last_chunk"]
        return mr.response_text or ""

    def _build_items(chunk_pairs: list[tuple[MessageResponse, Query]], global_start: int) -> list[dict]:
        items = []
        for i, (mr, q) in enumerate(chunk_pairs):
            idx = global_start + i
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
        return items

    batch_index_global = 0
    for criterion in criteria:
        system_content = _build_system_content(
            batch_prompt_template, system_behavior_section, criterion
        )
        for chunk_start in range(0, len(pairs), max_items_per_request):
            chunk_pairs = pairs[chunk_start : chunk_start + max_items_per_request]
            items = _build_items(chunk_pairs, chunk_start)
            items_json = json.dumps(items, ensure_ascii=False)
            user_content = f"Input list (JSON array):\n{items_json}\n\nReturn only the JSON array, no markdown or extra text."

            try:
                content = await chat_completion(system=system_content, user=user_content)
                results = _parse_batch_response(content)
            except Exception as e:
                results = [{"passed": False, "score": 0, "reason": str(e)} for _ in chunk_pairs]
            while len(results) < len(chunk_pairs):
                results.append({"passed": False, "score": 0, "reason": "Missing from LLM"})
            results = results[: len(chunk_pairs)]

            rvb = RunValidationBatch(
                run_id=run_id,
                batch_index=batch_index_global,
                status="running",
                started_at=datetime.utcnow(),
            )
            session.add(rvb)
            await session.flush()

            for (mr, _), res in zip(chunk_pairs, results):
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
            batch_index_global += 1
