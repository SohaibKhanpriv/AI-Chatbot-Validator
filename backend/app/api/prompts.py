import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select

from app.database import get_db, get_sync_session
from app.models import Prompt, ValidationCriterion
from app.schemas.prompts import (
    PromptOut,
    PromptUpdate,
    ValidationCriterionOut,
    ValidationCriterionUpdate,
    SystemBehaviorReferenceOut,
)
from app.services.prompt_hub_service import get_system_behavior_reference, set_system_behavior_reference
from sqlalchemy.ext.asyncio import AsyncSession
from app.prompt_hub.seed import run_seed

router = APIRouter(prefix="/prompts", tags=["prompts"])


@router.get("", response_model=list[PromptOut])
async def list_prompts(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Prompt).order_by(Prompt.key))
    prompts = result.scalars().all()
    return [PromptOut.model_validate(p) for p in prompts]


@router.get("/system-behavior-reference", response_model=SystemBehaviorReferenceOut)
async def get_system_behavior_reference_endpoint():
    content = get_system_behavior_reference()
    return SystemBehaviorReferenceOut(content=content)


@router.put("/system-behavior-reference", response_model=SystemBehaviorReferenceOut)
async def put_system_behavior_reference_endpoint(body: SystemBehaviorReferenceOut):
    set_system_behavior_reference(body.content or "")
    return SystemBehaviorReferenceOut(content=get_system_behavior_reference())


@router.get("/criteria", response_model=list[ValidationCriterionOut])
async def list_validation_criteria(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(ValidationCriterion).order_by(ValidationCriterion.sort_order)
    )
    criteria = result.scalars().all()
    return [ValidationCriterionOut.model_validate(c) for c in criteria]


@router.patch("/criteria/{criterion_id}", response_model=ValidationCriterionOut)
async def patch_criterion(
    criterion_id: int,
    body: ValidationCriterionUpdate,
    db: AsyncSession = Depends(get_db),
):
    criterion = await db.get(ValidationCriterion, criterion_id)
    if not criterion:
        raise HTTPException(404, "Criterion not found")
    if body.name is not None:
        criterion.name = body.name
    if body.description is not None:
        criterion.description = body.description
    if body.prompt_key is not None:
        criterion.prompt_key = body.prompt_key
    if body.active is not None:
        criterion.active = body.active
    if body.sort_order is not None:
        criterion.sort_order = body.sort_order
    if body.applies_to_all is not None:
        criterion.applies_to_all = body.applies_to_all
    if body.additional_info is not None:
        criterion.additional_info = body.additional_info
    await db.commit()
    await db.refresh(criterion)
    return ValidationCriterionOut.model_validate(criterion)


@router.get("/{prompt_id}", response_model=PromptOut)
async def get_prompt(prompt_id: int, db: AsyncSession = Depends(get_db)):
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")
    return PromptOut.model_validate(prompt)


@router.patch("/{prompt_id}", response_model=PromptOut)
async def patch_prompt(
    prompt_id: int,
    body: PromptUpdate,
    db: AsyncSession = Depends(get_db),
):
    prompt = await db.get(Prompt, prompt_id)
    if not prompt:
        raise HTTPException(404, "Prompt not found")
    if body.name is not None:
        prompt.name = body.name
    if body.body is not None:
        prompt.body = body.body
        prompt.version = (prompt.version or 1) + 1
    await db.commit()
    await db.refresh(prompt)
    return PromptOut.model_validate(prompt)


@router.post("/seed")
async def seed_prompts_and_criteria():
    def _sync_seed():
        session = get_sync_session()
        try:
            return run_seed(session)
        finally:
            session.close()

    try:
        a, b, c = await asyncio.to_thread(_sync_seed)
        return {
            "prompts_seeded": a,
            "criteria_seeded": b,
            "dataset_queries_seeded": c,
            "message": f"Seeded {a} prompts, {b} criteria, {c} dataset queries.",
        }
    except Exception as e:
        err = str(e).strip()
        if "applies_to_all" in err or "additional_info" in err or "system_behavior" in err or "column" in err.lower():
            raise HTTPException(
                status_code=500,
                detail="Database schema may be outdated. Run migration: cd backend && alembic upgrade head",
            ) from e
        raise HTTPException(status_code=500, detail=err or "Seed failed") from e
