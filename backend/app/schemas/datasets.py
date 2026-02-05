from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class DatasetCreate(BaseModel):
    name: str
    source_type: str  # file | text
    raw_content: Optional[str] = None
    system_behavior: Optional[str] = None


class DatasetOut(BaseModel):
    id: int
    name: str
    source_type: str
    created_at: datetime
    system_behavior: Optional[str] = None

    class Config:
        from_attributes = True


class QueryOut(BaseModel):
    id: int
    dataset_id: int
    query_text: str
    expectations: Optional[str] = None
    meta: Optional[dict] = None

    class Config:
        from_attributes = True


class QueryUpdate(BaseModel):
    query_text: Optional[str] = None
    expectations: Optional[str] = None


class DatasetUpdate(BaseModel):
    name: Optional[str] = None
    system_behavior: Optional[str] = None


class DatasetWithQueriesOut(DatasetOut):
    queries: list["QueryOut"] = []


DatasetWithQueriesOut.model_rebuild()
