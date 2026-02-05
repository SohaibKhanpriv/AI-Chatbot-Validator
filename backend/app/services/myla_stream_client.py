"""MYLA stream API client: POST to stream URL, consume SSE until last_message=True, return text and full last chunk."""
import json
import httpx


async def stream_myla_message(
    api_url: str,
    auth_token: str,
    message: str,
    new_thread: bool,
    *,
    timeout: float = 120.0,
) -> tuple[str, dict | None]:
    """
    POST to MYLA stream API, read SSE until last_message is True and chunk contains full message.
    Returns (final_response_text, last_chunk_dict).
    last_chunk_dict is the full chunk object (e.g. text, character/avatar, action_type, actions) when the last chunk is a dict; else None.
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": auth_token if auth_token.startswith("Bearer ") else f"Bearer {auth_token}",
    }
    body = {
        "message": message,
        "new_thread": new_thread,
        "is_audio": False,
    }
    full_text = ""
    last_chunk_dict: dict | None = None
    async with httpx.AsyncClient(timeout=timeout) as client:
        async with client.stream(
            "POST",
            api_url,
            json=body,
            headers=headers,
        ) as response:
            response.raise_for_status()
            buffer = ""
            async for chunk in response.aiter_text():
                buffer += chunk
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if not line.startswith("data: "):
                        continue
                    try:
                        json_str = line[6:].strip()
                        if not json_str:
                            continue
                        data = json.loads(json_str)
                    except json.JSONDecodeError:
                        continue
                    chunk_data = data.get("chunk")
                    last_message = data.get("last_message") is True
                    if chunk_data is None:
                        continue
                    if isinstance(chunk_data, str):
                        full_text += chunk_data
                    if last_message and isinstance(chunk_data, dict):
                        last_chunk_dict = chunk_data
                        msg = chunk_data.get("message")
                        if msg is not None:
                            if isinstance(msg, str):
                                try:
                                    parsed = json.loads(msg)
                                    full_text = parsed.get("text", msg)
                                except json.JSONDecodeError:
                                    full_text = msg
                            elif isinstance(msg, dict):
                                full_text = msg.get("text", str(msg))
                            else:
                                full_text = str(msg)
                        else:
                            full_text = full_text or chunk_data.get("text", "")
                        break
                    if last_message and isinstance(chunk_data, str):
                        break
    return (full_text, last_chunk_dict)
