"""LLM parser: raw text/file -> list of {query, expectations}; save to datasets + queries."""
import json
import re

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Dataset, Query
from app.services.prompt_hub_service import get_prompt_body
from app.services.llm_client import chat_completion


PARSE_PROMPT_KEY = "parse_queries_expectations"


async def parse_raw_content(session: AsyncSession, raw_text: str) -> list[dict]:
    """
    Call LLM with parse_queries_expectations prompt; return list of {query, expectations}.
    """
    body = await get_prompt_body(session, PARSE_PROMPT_KEY)
    if not body:
        raise ValueError(f"Prompt '{PARSE_PROMPT_KEY}' not found in prompt hub. Run seed.")
    content = await chat_completion(system=body, user=raw_text)
    content = content.strip()
    # Strip markdown code block if present
    if content.startswith("```"):
        content = re.sub(r"^```\w*\n?", "", content)
        content = re.sub(r"\n?```\s*$", "", content)
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        raise ValueError(f"LLM did not return valid JSON: {content[:500]}")
    if not isinstance(data, list):
        data = [data]
    out = []
    for item in data:
        if isinstance(item, dict) and ("query" in item or "question" in item):
            q = item.get("query") or item.get("question") or ""
            e = item.get("expectations") or item.get("expected") or item.get("expectation") or ""
            out.append({"query": str(q), "expectations": str(e)})
    return out


async def create_dataset_and_queries(
    session: AsyncSession,
    name: str,
    source_type: str,
    raw_content: str,
    system_behavior: str | None = None,
) -> tuple[Dataset, list[Query]]:
    """
    Parse raw_content with LLM, create Dataset and Query rows, return (dataset, queries).
    """
    items = await parse_raw_content(session, raw_content)
    dataset = Dataset(
        name=name,
        source_type=source_type,
        raw_content=raw_content,
        system_behavior=system_behavior,
    )
    session.add(dataset)
    await session.flush()
    queries = []
    for i, item in enumerate(items):
        q = Query(
            dataset_id=dataset.id,
            query_text=item["query"],
            expectations=item.get("expectations") or None,
            sort_order=i,
        )
        session.add(q)
        queries.append(q)
    await session.flush()
    return dataset, queries
