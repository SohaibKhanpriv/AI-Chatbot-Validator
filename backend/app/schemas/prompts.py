from pydantic import BaseModel
from datetime import datetime
from typing import Optional


class PromptOut(BaseModel):
    id: int
    key: str
    name: str
    body: str
    version: int
    created_at: datetime

    class Config:
        from_attributes = True


class PromptUpdate(BaseModel):
    name: Optional[str] = None
    body: Optional[str] = None


class ValidationCriterionOut(BaseModel):
    id: int
    key: str
    name: str
    description: str | None
    prompt_key: str | None
    active: bool
    sort_order: int
    applies_to_all: bool = True
    additional_info: str | None = None

    class Config:
        from_attributes = True


class ValidationCriterionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    prompt_key: Optional[str] = None
    active: Optional[bool] = None
    sort_order: Optional[int] = None
    applies_to_all: Optional[bool] = None
    additional_info: Optional[str] = None


class SystemBehaviorReferenceOut(BaseModel):
    content: str
