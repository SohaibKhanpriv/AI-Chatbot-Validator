from pydantic import BaseModel
from typing import Optional


class TimelineChunkOut(BaseModel):
    order: int
    avatar: str


class QueryTimelineItemOut(BaseModel):
    query_index: int
    query_text: str
    message_response_id: int
    response_text: Optional[str] = None  # full response message for this query (for hover)
    chunks: list[TimelineChunkOut]


class CharacterTimelineOut(BaseModel):
    run_id: int
    run_name: str
    items: list[QueryTimelineItemOut]
