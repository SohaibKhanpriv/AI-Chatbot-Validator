from pydantic import BaseModel
from typing import Any, Optional


class CriterionSummary(BaseModel):
    criterion_key: str
    passed_count: int
    total_count: int
    pass_rate_pct: float
    avg_score: Optional[float] = None


class RunReportOut(BaseModel):
    run_id: int
    total_queries: int
    responses_count: int
    success_count: int
    success_rate_pct: float
    per_criterion: list[CriterionSummary]


# Deep analysis: validations per query in a run
class ValidationItemOut(BaseModel):
    criterion_key: str
    criterion_name: str
    passed: bool  # effective: override_passed if set, else original passed
    score: Optional[float] = None
    reason: Optional[str] = None
    override_passed: Optional[bool] = None  # reviewer override; None = no override
    reviewer_comment: Optional[str] = None


class QueryValidationRow(BaseModel):
    message_response_id: int
    query_text: str
    expectations: Optional[str] = None
    expectations_clear: Optional[bool] = None
    response_text: Optional[str] = None
    response: Optional[Any] = None  # full object (text, character, actions) when available; else string
    error: Optional[str] = None
    validations: list[ValidationItemOut]
    all_passed: bool


class DeepAnalysisOut(BaseModel):
    run_id: int
    run_name: str
    total_queries: int
    responses_count: int
    success_count: int
    success_rate_pct: float
    criterion_keys: list[str]  # ordered, for table columns
    criterion_names: dict[str, str]  # key -> name
    rows: list[QueryValidationRow]


class ValidationOverrideUpdate(BaseModel):
    message_response_id: int
    criterion_key: str
    override_passed: Optional[bool] = None
    reviewer_comment: Optional[str] = None


class ValidationOverridesPatch(BaseModel):
    updates: list[ValidationOverrideUpdate]
