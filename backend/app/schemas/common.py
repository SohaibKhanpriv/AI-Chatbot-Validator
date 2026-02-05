from pydantic import BaseModel
from datetime import datetime
from typing import Any


class ProgressOut(BaseModel):
    processed: int
    total: int
    status: str
    remaining: int

    class Config:
        from_attributes = True
