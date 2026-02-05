"""Evaluate expectation clarity for dataset queries; write results to Query.meta."""
import json
import re

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Query
from app.services.prompt_hub_service import get_prompt_body, get_system_behavior_reference
from app.services.llm_client import chat_completion

BATCH_SIZE = 50
EVALUATE_CLARITY_PROMPT_KEY = "evaluate_expectation_clarity"


def _parse_clarity_response(content: str) -> list[dict]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```\w*\n?", "", content)
        content = re.sub(r"\n?```\s*$", "", content)
    data = json.loads(content)
    if not isinstance(data, list):
        return [data]
    return data


async def evaluate_dataset_expectations(
    session: AsyncSession, dataset_id: int
) -> tuple[int, int]:
    """
    For each query in the dataset, call LLM to evaluate expectation clarity.
    Write results to Query.meta (expectations_clear, expectations_feedback).
    Returns (clear_count, unclear_count).
    """
    result = await session.execute(
        select(Query).where(Query.dataset_id == dataset_id).order_by(Query.id)
    )
    queries = list(result.scalars().all())
    if not queries:
        return 0, 0

    prompt_body_template = await get_prompt_body(session, EVALUATE_CLARITY_PROMPT_KEY)
    if not prompt_body_template:
        raise ValueError(f"Prompt '{EVALUATE_CLARITY_PROMPT_KEY}' not found. Run seed.")

    reference_content = get_system_behavior_reference()
    system_msg = None
    if reference_content:
        system_msg = (
            "Use this reference to judge whether expectations are clear and specific enough to validate "
            "the chat system responses (text, avatar/character, action_type, actions, intents, etc.):\n\n"
            + reference_content
        )

    clear_count = 0
    unclear_count = 0

    for batch_start in range(0, len(queries), BATCH_SIZE):
        batch = queries[batch_start : batch_start + BATCH_SIZE]
        items = [
            {"query": q.query_text, "expectations": q.expectations or ""}
            for q in batch
        ]
        items_json = json.dumps(items, ensure_ascii=False)
        prompt_body = prompt_body_template.replace("{items_json}", items_json)

        try:
            content = await chat_completion(system=system_msg, user=prompt_body)
            results = _parse_clarity_response(content)
        except Exception as e:
            results = [{"clear": False, "suggestion": str(e)} for _ in batch]
        while len(results) < len(batch):
            results.append({"clear": False, "suggestion": "Missing from LLM"})
        results = results[: len(batch)]

        for q, res in zip(batch, results):
            if not isinstance(res, dict):
                res = {"clear": False, "suggestion": "Invalid result"}
            is_clear = bool(res.get("clear", False))
            suggestion = (res.get("suggestion") or "").strip() or None
            meta = dict(q.meta) if q.meta else {}
            meta["expectations_clear"] = is_clear
            meta["expectations_feedback"] = suggestion
            q.meta = meta
            if is_clear:
                clear_count += 1
            else:
                unclear_count += 1

    await session.commit()
    return clear_count, unclear_count
