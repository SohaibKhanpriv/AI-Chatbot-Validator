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
ITEMS_PLACEHOLDER = "Input list (JSON array): {items_json}"


def _response_payload(mr: MessageResponse) -> str | dict:
    if mr.raw_chunks and isinstance(mr.raw_chunks, dict) and "last_chunk" in mr.raw_chunks:
        return mr.raw_chunks["last_chunk"]
    return mr.response_text or ""


def _build_system_content(
    batch_prompt_template: str,
    system_behavior_section: str,
    criterion: ValidationCriterion,
) -> str:
    """Match validation_service: system message has no items (items go in user message)."""
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
    if ITEMS_PLACEHOLDER in full:
        full = full.replace(
            ITEMS_PLACEHOLDER,
            "The items will be provided in the next message. Output a JSON array with one object per item, in the same order.",
        )
    else:
        full = full.replace("{items_json}", "The items will be provided in the next message.")
    return full.strip()


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
    context_turns = settings.validation_context_turns
    max_items_per_request = settings.validation_max_items_per_request

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
            system_content = _build_system_content(
                batch_prompt_template, system_behavior_section, criterion
            )
            for chunk_start in range(0, len(pairs), max_items_per_request):
                chunk_pairs = pairs[chunk_start : chunk_start + max_items_per_request]
                items = []
                for i, (mr, q) in enumerate(chunk_pairs):
                    idx = chunk_start + i
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
                user_content = f"Input list (JSON array):\n{items_json}\n\nReturn only the JSON array, no markdown or extra text."
                input_tokens = count_tokens(system_content) + count_tokens(user_content)
                est_output_tokens = len(chunk_pairs) * EST_OUTPUT_TOKENS_PER_ITEM

                run_input_tokens += input_tokens
                run_est_output_tokens += est_output_tokens
                batch_details.append({
                    "criterion_key": criterion.key,
                    "batch_start": chunk_start,
                    "batch_size": len(chunk_pairs),
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
