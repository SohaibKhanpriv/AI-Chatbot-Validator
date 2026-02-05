from fastapi import APIRouter, Depends, HTTPException

from app.database import get_db
from app.models import Run
from app.schemas.common import ProgressOut
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/runs", tags=["progress"])


@router.get("/{run_id}/progress", response_model=ProgressOut)
async def get_run_progress(run_id: int, db: AsyncSession = Depends(get_db)):
    run = await db.get(Run, run_id)
    if not run:
        raise HTTPException(404, "Run not found")
    total = run.total_queries or 0
    processed = run.processed_count or 0
    return ProgressOut(
        processed=processed,
        total=total,
        status=run.status,
        remaining=max(0, total - processed),
    )
