from pydantic import BaseModel, field_validator
from datetime import datetime
from typing import Optional


class RunCreate(BaseModel):
    name: str
    dataset_id: int
    api_url: str
    auth_token: str
    new_thread_per_query: bool = True
    query_limit: Optional[int] = None  # None = all queries; N = run first N only (quick run)
    criterion_keys: Optional[list[str]] = None  # If set, only these validation criteria for this run; else use all active

    @field_validator("query_limit")
    @classmethod
    def query_limit_positive(cls, v: Optional[int]) -> Optional[int]:
        if v is not None and (v < 1 or v > 100_000):
            raise ValueError("query_limit must be between 1 and 100000")
        return v

    @field_validator("api_url")
    @classmethod
    def api_url_http_or_https(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("api_url required")
        if v.startswith("http://") or v.startswith("https://"):
            return v
        raise ValueError("api_url must start with http:// or https://")


class RunOut(BaseModel):
    id: int
    name: str
    dataset_id: int
    api_url: str
    new_thread_per_query: bool
    total_queries: int
    processed_count: int
    status: str
    validation_status: Optional[str] = None  # null | running | completed | failed
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
