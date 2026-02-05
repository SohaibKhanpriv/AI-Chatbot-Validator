from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.models import Dataset, Query
from app.schemas.datasets import (
    DatasetCreate,
    DatasetOut,
    DatasetUpdate,
    DatasetWithQueriesOut,
    QueryCreate,
    QueryOut,
    QueryUpdate,
    QueriesReorder,
)
from app.services.parser_service import create_dataset_and_queries
from app.services.file_text_extract import extract_text_from_file
from app.services.expectation_clarity_service import evaluate_dataset_expectations

router = APIRouter(prefix="/datasets", tags=["datasets"])


@router.post("/parse", response_model=DatasetWithQueriesOut)
async def parse_and_create(
    name: str = Form(...),
    source_type: str = Form("text"),
    raw_content: str | None = Form(None),
    system_behavior: str | None = Form(None),
    file: UploadFile | None = File(None),
    db: AsyncSession = Depends(get_db),
):
    if file:
        content = await file.read()
        raw_content = extract_text_from_file(content, file.filename, file.content_type)
        if not name or name == "undefined":
            name = file.filename or "uploaded"
    if not raw_content:
        raise HTTPException(400, "Provide raw_content or file")
    dataset, queries = await create_dataset_and_queries(
        db, name=name, source_type=source_type, raw_content=raw_content, system_behavior=system_behavior
    )
    await db.commit()
    await db.refresh(dataset)
    return DatasetWithQueriesOut(
        id=dataset.id,
        name=dataset.name,
        source_type=dataset.source_type,
        created_at=dataset.created_at,
        system_behavior=getattr(dataset, "system_behavior", None),
        queries=[QueryOut.model_validate(q) for q in queries],
    )


@router.get("", response_model=list[DatasetOut])
async def list_datasets(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Dataset).order_by(Dataset.created_at.desc()))
    datasets = result.scalars().all()
    return [DatasetOut.model_validate(d) for d in datasets]


@router.get("/{dataset_id}", response_model=DatasetWithQueriesOut)
async def get_dataset(dataset_id: int, db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    result = await db.execute(
        select(Query).where(Query.dataset_id == dataset_id).order_by(Query.sort_order, Query.id)
    )
    queries = result.scalars().all()
    return DatasetWithQueriesOut(
        id=dataset.id,
        name=dataset.name,
        source_type=dataset.source_type,
        created_at=dataset.created_at,
        system_behavior=getattr(dataset, "system_behavior", None),
        queries=[QueryOut.model_validate(q) for q in queries],
    )


@router.patch("/{dataset_id}", response_model=DatasetOut)
async def patch_dataset(
    dataset_id: int,
    body: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if body.name is not None:
        dataset.name = body.name
    if body.system_behavior is not None:
        dataset.system_behavior = body.system_behavior
    await db.commit()
    await db.refresh(dataset)
    return DatasetOut.model_validate(dataset)


@router.patch("/{dataset_id}/queries/{query_id}", response_model=QueryOut)
async def patch_query(
    dataset_id: int,
    query_id: int,
    body: QueryUpdate,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    query = await db.get(Query, query_id)
    if not query or query.dataset_id != dataset_id:
        raise HTTPException(404, "Query not found")
    if body.query_text is not None:
        query.query_text = body.query_text
    if body.expectations is not None:
        query.expectations = body.expectations
    if body.query_text is not None or body.expectations is not None:
        meta = dict(query.meta) if query.meta else {}
        meta.pop("expectations_clear", None)
        meta.pop("expectations_feedback", None)
        query.meta = meta if meta else None
    await db.commit()
    await db.refresh(query)
    return QueryOut.model_validate(query)


@router.post("/{dataset_id}/queries", response_model=QueryOut)
async def create_query(
    dataset_id: int,
    body: QueryCreate,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    max_order = await db.execute(
        select(func.coalesce(func.max(Query.sort_order), 0)).where(Query.dataset_id == dataset_id)
    )
    next_order = (max_order.scalar() or 0) + 1
    query = Query(
        dataset_id=dataset_id,
        query_text=body.query_text or "",
        expectations=body.expectations,
        sort_order=next_order,
    )
    db.add(query)
    await db.commit()
    await db.refresh(query)
    return QueryOut.model_validate(query)


@router.put("/{dataset_id}/queries/reorder", response_model=DatasetWithQueriesOut)
async def reorder_queries(
    dataset_id: int,
    body: QueriesReorder,
    db: AsyncSession = Depends(get_db),
):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    if not body.query_ids:
        result = await db.execute(
            select(Query).where(Query.dataset_id == dataset_id).order_by(Query.sort_order, Query.id)
        )
        queries = result.scalars().all()
        return DatasetWithQueriesOut(
            id=dataset.id,
            name=dataset.name,
            source_type=dataset.source_type,
            created_at=dataset.created_at,
            system_behavior=getattr(dataset, "system_behavior", None),
            queries=[QueryOut.model_validate(q) for q in queries],
        )
    for order, query_id in enumerate(body.query_ids):
        query = await db.get(Query, query_id)
        if query and query.dataset_id == dataset_id:
            query.sort_order = order
    await db.commit()
    result = await db.execute(
        select(Query).where(Query.dataset_id == dataset_id).order_by(Query.sort_order, Query.id)
    )
    queries = result.scalars().all()
    return DatasetWithQueriesOut(
        id=dataset.id,
        name=dataset.name,
        source_type=dataset.source_type,
        created_at=dataset.created_at,
        system_behavior=getattr(dataset, "system_behavior", None),
        queries=[QueryOut.model_validate(q) for q in queries],
    )


@router.post("/{dataset_id}/evaluate-expectations")
async def post_evaluate_expectations(dataset_id: int, db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    clear_count, unclear_count = await evaluate_dataset_expectations(db, dataset_id)
    return {"clear_count": clear_count, "unclear_count": unclear_count}


@router.delete("/{dataset_id}")
async def delete_dataset(dataset_id: int, db: AsyncSession = Depends(get_db)):
    dataset = await db.get(Dataset, dataset_id)
    if not dataset:
        raise HTTPException(404, "Dataset not found")
    await db.delete(dataset)
    await db.commit()
    return {"ok": True}
