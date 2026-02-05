"""
Estimate validation LLM token usage from DB.

Reconstructs the prompt sent for each validation batch (same logic as validation_service)
and counts approximate input tokens with tiktoken. Use this to understand cost after a run.

Usage:
  cd backend && python -m scripts.validation_token_usage [--run-id RUN_ID]
  # No --run-id = all runs that have validations
"""

import argparse
import json
import os
import sys

# Run from backend so app is importable
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select
from sqlalchemy.orm import Session

try:
    import tiktoken
    _encoding = tiktoken.get_encoding("cl100k_base")
    def _count_tokens(text: str) -> int:
        return len(_encoding.encode(text))
    _using_tiktoken = True
except ImportError:
    _encoding = None
    def _count_tokens(text: str) -> int:
        return (len(text) + 3) // 4  # rough ~4 chars per token
    _using_tiktoken = False

from app.config import get_settings
from app.database import get_sync_session, sync_engine
from app.models import (
    Dataset,
    Run,
    MessageResponse,
    Query,
    Prompt,
    ValidationCriterion,
    Validation,
    RunValidationBatch,
)
from app.services.prompt_hub_service import get_system_behavior_reference

VALIDATE_BATCH_PROMPT_KEY = "validate_batch"
ITEMS_PLACEHOLDER = "Input list (JSON array): {items_json}"


def _get_prompt_body_from_db(session: Session) -> str | None:
    r = session.execute(select(Prompt).where(Prompt.key == VALIDATE_BATCH_PROMPT_KEY))
    p = r.scalar_one_or_none()
    return p.body if p else None


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


def get_criteria_for_run(session: Session, run: Run) -> list[ValidationCriterion]:
    config = run.config if isinstance(run.config, dict) else {}
    criterion_keys = config.get("criterion_keys")
    if criterion_keys is not None:
        result = session.execute(
            select(ValidationCriterion)
            .where(ValidationCriterion.key.in_(criterion_keys))
            .order_by(ValidationCriterion.sort_order)
        )
        by_key = {c.key: c for c in result.scalars().all()}
        return [by_key[k] for k in criterion_keys if k in by_key]
    result = session.execute(
        select(ValidationCriterion)
        .where(ValidationCriterion.active == True)
        .order_by(ValidationCriterion.sort_order)
    )
    return list(result.scalars().all())


def estimate_validation_tokens(session: Session, run_id: int | None = None) -> list[dict]:
    settings = get_settings()
    context_turns = settings.validation_context_turns
    max_items_per_request = settings.validation_max_items_per_request

    batch_prompt_template = _get_prompt_body_from_db(session)
    if not batch_prompt_template:
        print("Warning: validate_batch prompt not found in DB. Run seed.")
        return []

    reference_content = get_system_behavior_reference()

    # Runs that have validations
    q = select(Run).where(Run.status == "completed")
    if run_id is not None:
        q = q.where(Run.id == run_id)
    runs_result = session.execute(q)
    runs = list(runs_result.scalars().all())

    # Filter to runs that have at least one validation
    run_ids_with_validations = set(
        row[0]
        for row in session.execute(
            select(Validation.run_id).distinct()
        ).all()
    )
    runs = [r for r in runs if r.id in run_ids_with_validations]

    rows = []
    for run in runs:
        # Pairs (message_response, query) in order
        pairs_result = session.execute(
            select(MessageResponse, Query)
            .join(Query, MessageResponse.query_id == Query.id)
            .where(MessageResponse.run_id == run.id)
            .order_by(MessageResponse.id)
        )
        pairs = list(pairs_result.all())
        if not pairs:
            continue

        dataset = session.get(Dataset, run.dataset_id) if run.dataset_id else None
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

        criteria = get_criteria_for_run(session, run)
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
                input_tokens = _count_tokens(system_content) + _count_tokens(user_content)
                est_output_per_item = 100
                est_output_tokens = len(chunk_pairs) * est_output_per_item

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


def main():
    parser = argparse.ArgumentParser(description="Estimate validation LLM token usage from DB")
    parser.add_argument("--run-id", type=int, help="Limit to this run ID")
    parser.add_argument("--cost", action="store_true", help="Show estimated cost (set INPUT_PER_1M and OUTPUT_PER_1M env or use defaults)")
    args = parser.parse_args()

    # Optional: cost per 1M tokens (USD). Adjust for your model.
    # e.g. GPT-4o mini: input ~0.15, output ~0.60; GPT-4: higher.
    input_per_1m = float(os.environ.get("INPUT_PER_1M", "2.50"))   # default rough GPT-4
    output_per_1m = float(os.environ.get("OUTPUT_PER_1M", "10.00"))

    session = get_sync_session()
    try:
        rows = estimate_validation_tokens(session, run_id=args.run_id)
    finally:
        session.close()

    if not rows:
        print("No runs with validations found.")
        return

    total_input = sum(r["total_input_tokens"] for r in rows)
    total_out = sum(r["total_est_output_tokens"] for r in rows)
    total_all = total_input + total_out

    print("=" * 80)
    print("VALIDATION TOKEN USAGE (approximate)")
    if _using_tiktoken:
        print("  Input tokens: tiktoken (cl100k_base). Output: estimated ~100 tokens per validated item.")
    else:
        print("  Input tokens: rough estimate (chars/4). Install tiktoken for accurate counts. Output: ~100/item.")
    print("=" * 80)

    for r in rows:
        print(f"\nRun {r['run_id']}: {r['run_name']}")
        print(f"  Queries: {r['total_queries']}  Criteria: {r['criteria_count']}  Batches: {r['batch_count']}")
        print(f"  Input tokens:  {r['total_input_tokens']:,}")
        print(f"  Est. output:   {r['total_est_output_tokens']:,}")
        print(f"  Est. total:    {r['total_est_tokens']:,}")
        if args.cost:
            cost = (r["total_input_tokens"] / 1e6 * input_per_1m) + (r["total_est_output_tokens"] / 1e6 * output_per_1m)
            print(f"  Est. cost:     ${cost:.2f}")
        if args.run_id and r["batch_details"]:
            print("  Per-batch:")
            for b in r["batch_details"]:
                print(f"    criterion={b['criterion_key']} batch_start={b['batch_start']} size={b['batch_size']} -> input_tokens={b['input_tokens']:,} est_output={b['est_output_tokens']}")

    print("\n" + "-" * 80)
    print("TOTAL (all runs)")
    print(f"  Input tokens:  {total_input:,}")
    print(f"  Est. output:   {total_out:,}")
    print(f"  Est. total:    {total_all:,}")
    if args.cost:
        cost = (total_input / 1e6 * input_per_1m) + (total_out / 1e6 * output_per_1m)
        print(f"  Est. cost:     ${cost:.2f}")
    print("=" * 80)
    print("To get cost for your model, set env: INPUT_PER_1M and OUTPUT_PER_1M (e.g. 2.5 and 10.0)")
    print("Then run with --cost")


if __name__ == "__main__":
    main()
