"""Prompt hub: get prompt by key from DB; list all prompts; load system behavior reference."""
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Prompt

_SYSTEM_BEHAVIOR_REFERENCE_PATH = (
    Path(__file__).resolve().parent.parent / "prompt_hub" / "system_behavior_reference.md"
)


def get_system_behavior_reference() -> str:
    """Load Chat System & Prompts reference for validation/clarity context. Returns empty string if file missing."""
    if not _SYSTEM_BEHAVIOR_REFERENCE_PATH.exists():
        return ""
    try:
        return _SYSTEM_BEHAVIOR_REFERENCE_PATH.read_text(encoding="utf-8").strip()
    except Exception:
        return ""


def set_system_behavior_reference(content: str) -> None:
    """Write Chat System & Prompts reference. Creates file if missing."""
    _SYSTEM_BEHAVIOR_REFERENCE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _SYSTEM_BEHAVIOR_REFERENCE_PATH.write_text(content, encoding="utf-8")


async def get_prompt_by_key(session: AsyncSession, key: str) -> Prompt | None:
    result = await session.execute(select(Prompt).where(Prompt.key == key))
    return result.scalar_one_or_none()


async def get_prompt_body(session: AsyncSession, key: str) -> str | None:
    p = await get_prompt_by_key(session, key)
    return p.body if p else None


async def list_prompts(session: AsyncSession) -> list[Prompt]:
    result = await session.execute(select(Prompt).order_by(Prompt.key))
    return list(result.scalars().all())
