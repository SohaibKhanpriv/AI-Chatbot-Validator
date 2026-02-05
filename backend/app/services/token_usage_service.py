"""Estimate validation LLM token usage from DB (async)."""
import json
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

try:
    import tiktoken
    _encoding = tiktoken.get_encoding("cl100k_base")
    def count_tokens(text: str) -> int:
        return len(_encoding.encode(text))
    using_tiktoken = True
except ImportError:
    def count_tokens(text: str) -> int:
        return (len(text) + 3) // 4
    using_tiktoken = False

from app.config import get_settings
from app.models import (
    Dataset,
    Run,
    MessageResponse,
    Query,
    ValidationCriterion,
    Validation,
)
from app.services.prompt_hub_service import get_prompt_body, get_system_behavior_reference

VALIDATE_BATCH_PROMPT_KEY = "validate_batch"
EST_OUTPUT_TOKENS_PER_ITEM = 100


def _response_payload(mr: MessageResponse) -> str | dict:
    if mr.raw_chunks and isinstance(mr.raw_chunks, dict) and "last_chunk" in mr.raw_chunks:
        return mr.raw_chunks["last_chunk"]
    return mr.response_text or ""


def _build_prompt_body(
    batch_prompt_template: str,
    criterion: ValidationCriterion,
    system_behavior_section: str,
    items_json: str,
) -> str:
    additional_info_section = ""
    if getattr(criterion, "additional_info", None) and (criterion.additional_info or "").strip():
        additional_info_section = f"Additional context for this criterion: {criterion.additional_info.strip()}\n\n"
    applies_to_all_instruction = ""
    if not getattr(criterion, "applies_to_all", True):
        applies_to_all_instruction = 'If this criterion does not apply to an item (e.g. no goal string in the query), output passed: true, score: 100, reason: "N/A - criterion not applicable".\n\n'
    prompt_body = batch_prompt_template.replace("{system_behavior}", system_behavior_section)
    prompt_body = prompt_body.replace("{criterion_name}", criterion.name)
    prompt_body = prompt_body.replace("{criterion_description}", criterion.description or "")
    prompt_body = prompt_body.replace("{additional_info}", additional_info_section)
    prompt_body = prompt_body.replace("{applies_to_all_instruction}", applies_to_all_instruction)
    prompt_body = prompt_body.replace("{items_json}", items_json)
    return prompt_body


async def _get_criteria_for_run(session: AsyncSession, run: Run) -> list[ValidationCriterion]:
    config = run.config if isinstance(run.config, dict) else {}
    criterion_keys = config.get("criterion_keys")
    if criterion_keys is not None:
        result = await session.execute(
            select(ValidationCriterion)
            .where(ValidationCriterion.key.in_(criterion_keys))
            .order_by(ValidationCriterion.sort_order)
        )
        by_key = {c.key: c for c in result.scalars().all()}
        return [by_key[k] for k in criterion_keys if k in by_key]
    result = await session.execute(
        select(ValidationCriterion)
        .where(ValidationCriterion.active == True)
        .order_by(ValidationCriterion.sort_order)
    )
    return list(result.scalars().all())


async def estimate_validation_tokens(
    session: AsyncSession, run_id: int | None = None
) -> list[dict]:
    """
    Reconstruct validation prompts and return approximate input + estimated output tokens per run.
    run_id=None means all completed runs that have validations.
    """
    settings = get_settings()
    batch_size = settings.validation_batch_size
    context_turns = settings.validation_context_turns

    batch_prompt_template = await get_prompt_body(session, VALIDATE_BATCH_PROMPT_KEY)
    if not batch_prompt_template:
        return []

    reference_content = get_system_behavior_reference()

    q = select(Run).where(Run.status == "completed")
    if run_id is not None:
        q = q.where(Run.id == run_id)
    result = await session.execute(q)
    runs = list(result.scalars().all())

    run_ids_with_validations = set(
        row[0]
        for row in (await session.execute(select(Validation.run_id).distinct())).all()
    )
    runs = [r for r in runs if r.id in run_ids_with_validations]

    rows = []
    for run in runs:
        result = await session.execute(
            select(MessageResponse, Query)
            .join(Query, MessageResponse.query_id == Query.id)
            .where(MessageResponse.run_id == run.id)
            .order_by(MessageResponse.id)
        )
        pairs = list(result.all())
        if not pairs:
            continue

        dataset = await session.get(Dataset, run.dataset_id) if run.dataset_id else None
        system_behavior_parts = []
        if dataset and getattr(dataset, "system_behavior", None) and (dataset.system_behavior or "").strip():
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

        criteria = await _get_criteria_for_run(session, run)
        if not criteria:
            continue

        run_input_tokens = 0
        run_est_output_tokens = 0
        batch_details = []

        for criterion in criteria:
            for batch_start in range(0, len(pairs), batch_size):
                batch_pairs = pairs[batch_start : batch_start + batch_size]
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
                prompt_body = _build_prompt_body(
                    batch_prompt_template,
                    criterion,
                    system_behavior_section,
                    items_json,
                )
                input_tokens = count_tokens(prompt_body)
                est_output_tokens = len(batch_pairs) * EST_OUTPUT_TOKENS_PER_ITEM

                run_input_tokens += input_tokens
                run_est_output_tokens += est_output_tokens
                batch_details.append({
                    "criterion_key": criterion.key,
                    "batch_start": batch_start,
                    "batch_size": len(batch_pairs),
                    "input_tokens": input_tokens,
                    "est_output_tokens": est_output_tokens,
                })

        rows.append({
            "run_id": run.id,
            "run_name": run.name,
            "total_queries": run.total_queries,
            "criteria_count": len(criteria),
            "batch_count": len(batch_details),
            "total_input_tokens": run_input_tokens,
            "total_est_output_tokens": run_est_output_tokens,
            "total_est_tokens": run_input_tokens + run_est_output_tokens,
            "batch_details": batch_details,
        })

    return rows
