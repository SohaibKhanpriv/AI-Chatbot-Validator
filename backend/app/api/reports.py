from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Run, MessageResponse, Query, Validation, ValidationCriterion
from app.schemas.reports import (
    RunReportOut,
    CriterionSummary,
    DeepAnalysisOut,
    QueryValidationRow,
    ValidationItemOut,
    ValidationOverridesPatch,
)
from app.schemas.character_timeline import (
    CharacterTimelineOut,
    QueryTimelineItemOut,
    TimelineChunkOut,
)

router = APIRouter(prefix="/runs", tags=["reports"])


def _effective_passed(passed: bool, details: dict | None) -> bool:
    """Use override_passed from details if present, else original passed."""
    if details is not None and "override_passed" in details:
        val = details["override_passed"]
        if val is not None:
            return bool(val)
    return passed


@router.get("/{run_id}/report", response_model=RunReportOut)
async def get_run_report(run_id: int, db: AsyncSession = Depends(get_db)):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    responses_count_result = await db.execute(
        select(func.count(MessageResponse.id)).where(MessageResponse.run_id == run_id)
    )
    responses_count = responses_count_result.scalar() or 0
    if responses_count == 0:
        return RunReportOut(
            run_id=run_id,
            total_queries=run.total_queries or 0,
            responses_count=0,
            success_count=0,
            success_rate_pct=0.0,
            per_criterion=[],
        )
    # Per message_response: "success" = all criteria passed for that response (using effective passed = override if set)
    validations_result = await db.execute(
        select(
            Validation.message_response_id,
            Validation.criterion_key,
            Validation.passed,
            Validation.score,
            Validation.details,
        ).where(Validation.run_id == run_id)
    )
    rows = validations_result.all()
    mr_criteria: dict[int, list[tuple[str, bool, float | None]]] = {}
    for mr_id, ckey, passed, score, details in rows:
        eff = _effective_passed(passed, details)
        if mr_id not in mr_criteria:
            mr_criteria[mr_id] = []
        mr_criteria[mr_id].append((ckey, eff, score))
    success_count = sum(1 for v in mr_criteria.values() if all(p for _, p, _ in v))
    success_rate = (success_count / responses_count * 100) if responses_count else 0.0
    criterion_keys = set()
    for v in mr_criteria.values():
        for ckey, _, _ in v:
            criterion_keys.add(ckey)
    per_criterion = []
    for ckey in sorted(criterion_keys):
        passed_count = sum(1 for v in mr_criteria.values() for (k, p, _) in v if k == ckey and p)
        total_count = sum(1 for v in mr_criteria.values() for (k, _, _) in v if k == ckey)
        scores = [s for v in mr_criteria.values() for (k, _, s) in v if k == ckey and s is not None]
        avg_score = sum(s for s in scores) / len(scores) if scores else None
        pass_rate = (passed_count / total_count * 100) if total_count else 0.0
        per_criterion.append(
            CriterionSummary(
                criterion_key=ckey,
                passed_count=passed_count,
                total_count=total_count,
                pass_rate_pct=pass_rate,
                avg_score=float(avg_score) if avg_score is not None else None,
            )
        )
    return RunReportOut(
        run_id=run_id,
        total_queries=run.total_queries or 0,
        responses_count=responses_count,
        success_count=success_count,
        success_rate_pct=success_rate,
        per_criterion=per_criterion,
    )


@router.get("/{run_id}/analysis", response_model=DeepAnalysisOut)
async def get_run_deep_analysis(run_id: int, db: AsyncSession = Depends(get_db)):
    """Return validations for each query in the run (message_response + validations per criterion)."""
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    # MessageResponse + Query for this run
    mr_q_result = await db.execute(
        select(MessageResponse, Query)
        .join(Query, MessageResponse.query_id == Query.id)
        .where(MessageResponse.run_id == run_id)
        .order_by(MessageResponse.id)
    )
    pairs = list(mr_q_result.all())
    if not pairs:
        return DeepAnalysisOut(
            run_id=run_id,
            run_name=run.name or "",
            total_queries=run.total_queries or 0,
            responses_count=0,
            success_count=0,
            success_rate_pct=0.0,
            criterion_keys=[],
            criterion_names={},
            rows=[],
        )
    # All validations for this run
    val_result = await db.execute(
        select(Validation)
        .where(Validation.run_id == run_id)
        .order_by(Validation.message_response_id, Validation.criterion_key)
    )
    validations = list(val_result.scalars().all())
    # Criterion key -> name
    criterion_keys_seen = {v.criterion_key for v in validations}
    criterion_names: dict[str, str] = {}
    if criterion_keys_seen:
        crit_result = await db.execute(
            select(ValidationCriterion.key, ValidationCriterion.name).where(
                ValidationCriterion.key.in_(criterion_keys_seen)
            )
        )
        for k, name in crit_result.all():
            criterion_names[k] = name
    criterion_keys_ordered = sorted(criterion_keys_seen)
    # validations by message_response_id -> list of Validation
    by_mr: dict[int, list] = {}
    for v in validations:
        by_mr.setdefault(v.message_response_id, []).append(v)
    rows: list[QueryValidationRow] = []
    success_count = 0
    for mr, q in pairs:
        vals = by_mr.get(mr.id, [])
        items = []
        for v in vals:
            d = v.details if isinstance(v.details, dict) else {}
            eff = _effective_passed(v.passed, d)
            override_passed = d.get("override_passed") if "override_passed" in d else None
            reviewer_comment = d.get("reviewer_comment") if isinstance(d.get("reviewer_comment"), str) else None
            items.append(
                ValidationItemOut(
                    criterion_key=v.criterion_key,
                    criterion_name=criterion_names.get(v.criterion_key, v.criterion_key),
                    passed=eff,
                    score=float(v.score) if v.score is not None else None,
                    reason=d.get("reason") if isinstance(d.get("reason"), str) else None,
                    override_passed=override_passed,
                    reviewer_comment=reviewer_comment,
                )
            )
        all_passed = len(items) > 0 and all(it.passed for it in items)
        if all_passed:
            success_count += 1
        meta = q.meta if isinstance(q.meta, dict) else {}
        expectations_clear = meta.get("expectations_clear") if meta else None
        response_full = None
        if mr.raw_chunks and isinstance(mr.raw_chunks, dict) and "last_chunk" in mr.raw_chunks:
            response_full = mr.raw_chunks["last_chunk"]
        else:
            response_full = mr.response_text
        rows.append(
            QueryValidationRow(
                message_response_id=mr.id,
                query_text=q.query_text or "",
                expectations=q.expectations,
                expectations_clear=expectations_clear,
                response_text=mr.response_text,
                response=response_full,
                error=mr.error,
                validations=items,
                all_passed=all_passed,
            )
        )
    responses_count = len(rows)
    success_rate = (success_count / responses_count * 100) if responses_count else 0.0
    return DeepAnalysisOut(
        run_id=run_id,
        run_name=run.name or "",
        total_queries=run.total_queries or 0,
        responses_count=responses_count,
        success_count=success_count,
        success_rate_pct=success_rate,
        criterion_keys=criterion_keys_ordered,
        criterion_names=criterion_names,
        rows=rows,
    )


def _avatar_from_chunk(chunk: dict) -> str | None:
    for key in ("avatar", "character"):
        val = chunk.get(key)
        if val is not None and isinstance(val, str) and val.strip():
            return val.strip()
    msg = chunk.get("message")
    if isinstance(msg, dict):
        for key in ("avatar", "character"):
            val = msg.get(key) if msg else None
            if val is not None and isinstance(val, str) and val.strip():
                return val.strip()
    return None


@router.get("/{run_id}/character-timeline", response_model=CharacterTimelineOut)
async def get_character_timeline(run_id: int, db: AsyncSession = Depends(get_db)):
    """Return per-query timeline of avatar (character) chunks for the run."""
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    mr_q_result = await db.execute(
        select(MessageResponse, Query)
        .join(Query, MessageResponse.query_id == Query.id)
        .where(MessageResponse.run_id == run_id)
        .order_by(MessageResponse.id)
    )
    pairs = list(mr_q_result.all())
    items: list[QueryTimelineItemOut] = []
    for idx, (mr, q) in enumerate(pairs):
        chunks_out: list[TimelineChunkOut] = []
        raw = mr.raw_chunks if isinstance(mr.raw_chunks, dict) else None
        if raw and "stream_chunks" in raw and isinstance(raw["stream_chunks"], list):
            for c in raw["stream_chunks"]:
                if isinstance(c, dict) and "avatar" in c and "order" in c:
                    chunks_out.append(TimelineChunkOut(order=c["order"], avatar=str(c["avatar"])))
        if not chunks_out and raw and "last_chunk" in raw:
            last = raw["last_chunk"]
            if isinstance(last, dict):
                avatar = _avatar_from_chunk(last)
                if avatar:
                    chunks_out.append(TimelineChunkOut(order=1, avatar=avatar))
        items.append(
            QueryTimelineItemOut(
                query_index=idx + 1,
                query_text=q.query_text or "",
                message_response_id=mr.id,
                response_text=mr.response_text if mr.response_text else None,
                chunks=chunks_out,
            )
        )
    return CharacterTimelineOut(
        run_id=run_id,
        run_name=run.name or "",
        items=items,
    )


@router.patch("/{run_id}/validations")
async def patch_run_validations(
    run_id: int,
    body: ValidationOverridesPatch,
    db: AsyncSession = Depends(get_db),
):
    """Update override_passed and/or reviewer_comment for validations. Keys not sent are left unchanged; null clears."""
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    if not body.updates:
        return {"updated": 0}
    # Load all validations for this run that match any (message_response_id, criterion_key) in updates
    keys = {(u.message_response_id, u.criterion_key) for u in body.updates}
    result = await db.execute(
        select(Validation).where(
            Validation.run_id == run_id,
            Validation.message_response_id.in_({k[0] for k in keys}),
            Validation.criterion_key.in_({k[1] for k in keys}),
        )
    )
    validations = {((v.message_response_id, v.criterion_key)): v for v in result.scalars().all()}
    updated = 0
    for u in body.updates:
        v = validations.get((u.message_response_id, u.criterion_key))
        if not v:
            continue
        details = dict(v.details) if isinstance(v.details, dict) else {}
        payload = u.model_dump(exclude_unset=True)
        if "override_passed" in payload:
            if u.override_passed is None:
                details.pop("override_passed", None)
            else:
                details["override_passed"] = u.override_passed
        if "reviewer_comment" in payload:
            if u.reviewer_comment is None:
                details.pop("reviewer_comment", None)
            else:
                details["reviewer_comment"] = u.reviewer_comment
        v.details = details if details else None
        updated += 1
    await db.commit()
    return {"updated": updated}
