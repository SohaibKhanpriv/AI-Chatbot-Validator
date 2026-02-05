"""Process run: for each query call MYLA stream API, save response, update run progress."""
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Run, Query, MessageResponse
from app.services.myla_stream_client import stream_myla_message


async def get_run_with_queries(session: AsyncSession, run_id: int) -> Run | None:
    result = await session.execute(
        select(Run).where(Run.id == run_id)
    )
    run = result.scalar_one_or_none()
    if not run:
        return None
    return run


async def get_queries_for_dataset(session: AsyncSession, dataset_id: int) -> list[Query]:
    result = await session.execute(
        select(Query).where(Query.dataset_id == dataset_id).order_by(Query.id)
    )
    return list(result.scalars().all())


async def process_run(session: AsyncSession, run_id: int) -> None:
    """
    For the given run: fetch queries, call MYLA stream for each, save MessageResponse, update run progress.
    """
    run = await get_run_with_queries(session, run_id)
    if not run:
        raise ValueError(f"Run {run_id} not found")
    if run.status not in ("pending", "failed"):
        return
    queries = await get_queries_for_dataset(session, run.dataset_id)
    if not queries:
        run.status = "completed"
        run.completed_at = datetime.utcnow()
        await session.commit()
        return

    limit = None
    if run.config and isinstance(run.config.get("query_limit"), int) and run.config["query_limit"] >= 1:
        limit = run.config["query_limit"]
        queries = queries[:limit]
    if not queries:
        run.status = "completed"
        run.completed_at = datetime.utcnow()
        await session.commit()
        return

    run.status = "running"
    run.started_at = datetime.utcnow()
    run.total_queries = len(queries)
    await session.commit()

    auth_token = run.auth_token_encrypted or ""
    api_url = run.api_url
    new_thread = run.new_thread_per_query

    for i, q in enumerate(queries):
        try:
            response_text, last_chunk, stream_chunks = await stream_myla_message(
                api_url=api_url,
                auth_token=auth_token,
                message=q.query_text,
                new_thread=new_thread,
            )
            raw_chunks = None
            if last_chunk or stream_chunks:
                raw_chunks = {}
                if last_chunk is not None:
                    raw_chunks["last_chunk"] = last_chunk
                if stream_chunks:
                    raw_chunks["stream_chunks"] = stream_chunks
            mr = MessageResponse(
                run_id=run_id,
                query_id=q.id,
                request_message=q.query_text,
                response_text=response_text,
                raw_chunks=raw_chunks,
                error=None,
            )
            session.add(mr)
        except Exception as e:
            mr = MessageResponse(
                run_id=run_id,
                query_id=q.id,
                request_message=q.query_text,
                response_text=None,
                raw_chunks=None,
                error=str(e),
            )
            session.add(mr)

        run.processed_count = i + 1
        await session.commit()
        await session.refresh(run)

    run.status = "completed"
    run.completed_at = datetime.utcnow()
    await session.commit()
