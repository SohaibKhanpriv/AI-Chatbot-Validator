from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Run, Query
from app.schemas.runs import RunCreate, RunOut
from app.services.message_processing_service import process_run
from app.services.validation_service import validate_run
from app.services.token_usage_service import estimate_validation_tokens

router = APIRouter(prefix="/runs", tags=["runs"])


@router.post("", response_model=RunOut)
async def create_run(
    body: RunCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    from app.models import Dataset
    dataset = await db.get(Dataset, body.dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    result = await db.execute(select(Query).where(Query.dataset_id == body.dataset_id).order_by(Query.id))
    all_queries = result.scalars().all()
    total = len(all_queries)
    if body.query_limit is not None and body.query_limit >= 1:
        total = min(total, body.query_limit)
    config = {}
    if body.query_limit is not None:
        config["query_limit"] = body.query_limit
    if body.criterion_keys is not None:
        config["criterion_keys"] = body.criterion_keys
    run = Run(
        name=body.name,
        dataset_id=body.dataset_id,
        api_url=body.api_url,
        auth_token_encrypted=body.auth_token,
        new_thread_per_query=body.new_thread_per_query,
        total_queries=total,
        processed_count=0,
        status="pending",
        config=config if config else None,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    background_tasks.add_task(_run_message_processing, run.id)
    return RunOut.model_validate(run)


async def _run_message_processing(run_id: int):
    """Run message processing only. Validation is started manually via POST /runs/{id}/validate."""
    from app.database import async_session_maker
    async with async_session_maker() as session:
        try:
            await process_run(session, run_id)
        except Exception:
            async with async_session_maker() as session2:
                run = await session2.get(Run, run_id)
                if run:
                    run.status = "failed"
                    await session2.commit()


async def _run_validation(run_id: int):
    """Background task: run validation and set validation_status completed/failed."""
    from app.database import async_session_maker
    async with async_session_maker() as session:
        try:
            await validate_run(session, run_id)
        except Exception:
            async with async_session_maker() as session2:
                run = await session2.get(Run, run_id)
                if run:
                    run.validation_status = "failed"
                    await session2.commit()
            return
    async with async_session_maker() as session2:
        run = await session2.get(Run, run_id)
        if run:
            run.validation_status = "completed"
            await session2.commit()


@router.get("", response_model=list[RunOut])
async def list_runs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Run).order_by(Run.created_at.desc()))
    runs = result.scalars().all()
    return [RunOut.model_validate(r) for r in runs]


@router.get("/token-usage")
async def get_all_runs_token_usage(db: AsyncSession = Depends(get_db)):
    """
    Approximate validation token usage for all completed runs that have validations.
    Input tokens from reconstructed prompts (tiktoken if available); output estimated ~100 tokens per item.
    """
    rows = await estimate_validation_tokens(db, run_id=None)
    total_input = sum(r["total_input_tokens"] for r in rows)
    total_est_output = sum(r["total_est_output_tokens"] for r in rows)
    return {
        "runs": rows,
        "totals": {
            "total_input_tokens": total_input,
            "total_est_output_tokens": total_est_output,
            "total_est_tokens": total_input + total_est_output,
        },
    }


@router.get("/{run_id}/token-usage")
async def get_run_token_usage(run_id: int, db: AsyncSession = Depends(get_db)):
    """
    Approximate validation token usage for one run: input tokens per batch and totals.
    """
    rows = await estimate_validation_tokens(db, run_id=run_id)
    if not rows:
        raise HTTPException(404, "Run not found or has no validations")
    return rows[0]


@router.post("/{run_id}/validate", response_model=RunOut)
async def start_validation(
    run_id: int,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Start validation for a completed run. Runs in the background."""
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    if run.status != "completed":
        raise HTTPException(400, "Run must be completed before validation can start")
    if run.validation_status == "running":
        raise HTTPException(409, "Validation already in progress")
    run.validation_status = "running"
    await db.commit()
    await db.refresh(run)
    background_tasks.add_task(_run_validation, run_id)
    return RunOut.model_validate(run)


@router.get("/{run_id}", response_model=RunOut)
async def get_run(run_id: int, db: AsyncSession = Depends(get_db)):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    return RunOut.model_validate(run)


@router.delete("/{run_id}")
async def delete_run(run_id: int, db: AsyncSession = Depends(get_db)):
    """Delete a run and all related records (message_responses, validations, run_validation_batches)."""
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    await db.delete(run)
    await db.commit()
    return {"ok": True}
