"""LLM client (OpenAI-compatible) for parser and validation."""
from openai import AsyncOpenAI

from app.config import get_settings


def get_llm_client() -> AsyncOpenAI:
    s = get_settings()
    return AsyncOpenAI(api_key=s.llm_api_key, base_url=s.llm_base_url)


async def chat_completion(system: str | None, user: str, model: str = "gpt-5-mini") -> str:
    client = get_llm_client()
    messages = []
    if system:
        messages.append({"role": "system", "content": system})
    messages.append({"role": "user", "content": user})
    r = await client.chat.completions.create(model=model, messages=messages)
    return r.choices[0].message.content or ""
