from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import Run, Query
from app.schemas.runs import RunCreate, RunOut
from app.services.message_processing_service import process_run
from app.services.validation_service import validate_run

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
    config = {"query_limit": body.query_limit} if body.query_limit is not None else None
    run = Run(
        name=body.name,
        dataset_id=body.dataset_id,
        api_url=body.api_url,
        auth_token_encrypted=body.auth_token,
        new_thread_per_query=body.new_thread_per_query,
        total_queries=total,
        processed_count=0,
        status="pending",
        config=config,
    )
    db.add(run)
    await db.commit()
    await db.refresh(run)
    background_tasks.add_task(_run_message_processing, run.id)
    return RunOut.model_validate(run)


async def _run_message_processing(run_id: int):
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
        else:
            async with async_session_maker() as session2:
                try:
                    await validate_run(session2, run_id)
                except Exception:
                    pass


@router.get("", response_model=list[RunOut])
async def list_runs(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Run).order_by(Run.created_at.desc()))
    runs = result.scalars().all()
    return [RunOut.model_validate(r) for r in runs]


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
