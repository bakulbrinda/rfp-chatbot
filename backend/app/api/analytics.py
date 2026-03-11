import csv
import io
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.dependencies import require_admin
from app.models.db_models import Document, QueryLog

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/summary")
async def analytics_summary(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    now = datetime.now(timezone.utc)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)

    # Total queries
    total = (await db.execute(select(func.count()).select_from(QueryLog))).scalar_one()
    total_last_week = (
        await db.execute(
            select(func.count()).select_from(QueryLog).where(QueryLog.created_at >= week_ago)
        )
    ).scalar_one()
    total_prev_week = (
        await db.execute(
            select(func.count())
            .select_from(QueryLog)
            .where(QueryLog.created_at >= two_weeks_ago, QueryLog.created_at < week_ago)
        )
    ).scalar_one()

    # Answer rate
    answered = (
        await db.execute(
            select(func.count()).select_from(QueryLog).where(QueryLog.answer_found == True)  # noqa: E712
        )
    ).scalar_one()
    answer_rate = round(answered / total * 100, 1) if total > 0 else 0.0
    answered_lw = (
        await db.execute(
            select(func.count())
            .select_from(QueryLog)
            .where(QueryLog.answer_found == True, QueryLog.created_at >= week_ago)  # noqa: E712
        )
    ).scalar_one()
    total_lw_for_rate = (
        await db.execute(
            select(func.count()).select_from(QueryLog).where(QueryLog.created_at >= week_ago)
        )
    ).scalar_one()
    answer_rate_lw = round(answered_lw / total_lw_for_rate * 100, 1) if total_lw_for_rate > 0 else 0.0

    # Avg confidence score (map to number)
    conf_map = {"high": 1.0, "medium": 0.6, "low": 0.3, "not_found": 0.0}
    conf_rows = (
        await db.execute(
            select(QueryLog.confidence, func.count().label("cnt"))
            .where(QueryLog.confidence.isnot(None))
            .group_by(QueryLog.confidence)
        )
    ).all()
    total_conf = sum(r.cnt for r in conf_rows)
    avg_conf = (
        round(sum(conf_map.get(r.confidence, 0) * r.cnt for r in conf_rows) / total_conf * 100, 1)
        if total_conf > 0
        else 0.0
    )

    # Documents in KB
    doc_count = (await db.execute(select(func.count()).select_from(Document))).scalar_one()
    indexed_count = (
        await db.execute(
            select(func.count()).select_from(Document).where(Document.status == "indexed")
        )
    ).scalar_one()

    return {
        "total_queries": total,
        "total_queries_last_week": total_last_week,
        "total_queries_prev_week": total_prev_week,
        "answer_rate": answer_rate,
        "answer_rate_last_week": answer_rate_lw,
        "avg_confidence_pct": avg_conf,
        "documents_total": doc_count,
        "documents_indexed": indexed_count,
    }


@router.get("/volume")
async def analytics_volume(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Query counts per day for the last 30 days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=30)
    rows = (
        await db.execute(
            select(
                func.date_trunc("day", QueryLog.created_at).label("day"),
                func.count().label("count"),
            )
            .where(QueryLog.created_at >= cutoff)
            .group_by(text("day"))
            .order_by(text("day"))
        )
    ).all()
    return [{"date": r.day.strftime("%Y-%m-%d"), "count": r.count} for r in rows]


@router.get("/confidence")
async def analytics_confidence(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Count per confidence level."""
    rows = (
        await db.execute(
            select(QueryLog.confidence, func.count().label("count"))
            .group_by(QueryLog.confidence)
        )
    ).all()
    return [{"confidence": r.confidence or "not_found", "count": r.count} for r in rows]


@router.get("/top-queries")
async def analytics_top_queries(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Top 10 most asked queries (exact deduplication by text)."""
    rows = (
        await db.execute(
            select(QueryLog.query_text, func.count().label("count"))
            .group_by(QueryLog.query_text)
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()
    return [{"query": r.query_text, "count": r.count} for r in rows]


@router.get("/gaps")
async def analytics_gaps(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Top 10 unanswered queries sorted by frequency."""
    rows = (
        await db.execute(
            select(QueryLog.query_text, func.count().label("count"))
            .where(QueryLog.answer_found == False)  # noqa: E712
            .group_by(QueryLog.query_text)
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()
    return [{"query": r.query_text, "count": r.count} for r in rows]


@router.get("/export")
async def analytics_export(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Download full query log as CSV."""
    rows = (
        await db.execute(
            select(QueryLog).order_by(QueryLog.created_at.desc()).limit(10000)
        )
    ).scalars().all()

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "created_at", "module", "query_text", "answer_found", "confidence"])
    for r in rows:
        writer.writerow([str(r.id), r.created_at.isoformat(), r.module, r.query_text, r.answer_found, r.confidence or ""])

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=query_logs.csv"},
    )
