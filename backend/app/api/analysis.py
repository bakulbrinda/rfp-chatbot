import uuid
from datetime import datetime, timezone

from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from qdrant_client import AsyncQdrantClient
from sqlalchemy.ext.asyncio import AsyncSession
import cohere

from app.config import settings
from app.core.utils.query_sanitizer import sanitize_query
from app.core.utils.rate_limiter import limiter
from app.db.session import get_db
from app.dependencies import get_qdrant_client, get_cohere_client, get_anthropic_client, get_current_user
from app.models.db_models import User
from app.core.rag.retriever import hybrid_search
from app.core.rag.reranker import rerank
from app.core.llm.analysis_service import run_analysis

router = APIRouter()


class AnalysisRequest(BaseModel):
    requirements: str
    client_name: str | None = None


class ScopeItem(BaseModel):
    point: str
    source: str | None = None


class AnalysisResponse(BaseModel):
    id: str
    client_name: str | None
    in_scope: list[ScopeItem]
    out_of_scope: list[ScopeItem]
    future_scope: list[ScopeItem]
    created_at: str


@router.post("", response_model=AnalysisResponse)
@limiter.limit("10/minute")
async def run_analysis_endpoint(
    request: Request,
    body: AnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
    anthropic_client: AsyncAnthropic = Depends(get_anthropic_client),
):
    clean_requirements = sanitize_query(body.requirements)
    if not clean_requirements:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Requirements cannot be empty.")

    # RAG retrieval
    results = await hybrid_search(clean_requirements, qdrant_client, cohere_client, settings.QDRANT_COLLECTION, top_k=20)
    reranked = await rerank(clean_requirements, results, cohere_client, top_n=10)

    if not reranked:
        return AnalysisResponse(
            id=str(uuid.uuid4()),
            client_name=body.client_name,
            in_scope=[],
            out_of_scope=[ScopeItem(point="No relevant documents found in knowledge base.", source=None)],
            future_scope=[],
            created_at=datetime.now(timezone.utc).isoformat(),
        )

    result = await run_analysis(
        requirements=clean_requirements,
        chunks=reranked,
        anthropic_client=anthropic_client,
        client_name=body.client_name,
    )

    def parse_items(raw: list) -> list[ScopeItem]:
        items = []
        for item in raw:
            if isinstance(item, dict):
                items.append(ScopeItem(point=item.get("point", ""), source=item.get("source")))
            elif isinstance(item, str):
                items.append(ScopeItem(point=item, source=None))
        return items

    return AnalysisResponse(
        id=str(uuid.uuid4()),
        client_name=body.client_name,
        in_scope=parse_items(result.get("in_scope", [])),
        out_of_scope=parse_items(result.get("out_of_scope", [])),
        future_scope=parse_items(result.get("future_scope", [])),
        created_at=datetime.now(timezone.utc).isoformat(),
    )


class CompareRequest(BaseModel):
    criteria_a: str
    client_a: str | None = None
    criteria_b: str
    client_b: str | None = None


class CompareResponse(BaseModel):
    client_a: str | None
    client_b: str | None
    result_a: dict
    result_b: dict
    created_at: str


@router.post("/compare", response_model=CompareResponse)
@limiter.limit("10/minute")
async def compare_analysis(
    request: Request,
    body: CompareRequest,
    current_user: User = Depends(get_current_user),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
    anthropic_client: AsyncAnthropic = Depends(get_anthropic_client),
):
    import asyncio as _asyncio

    clean_a = sanitize_query(body.criteria_a)
    clean_b = sanitize_query(body.criteria_b)
    if not clean_a or not clean_b:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Both criteria fields are required.")

    async def _run_single(criteria: str, client_name: str | None) -> dict:
        results = await hybrid_search(criteria, qdrant_client, cohere_client, settings.QDRANT_COLLECTION, top_k=20)
        reranked = await rerank(criteria, results, cohere_client, top_n=10)
        if not reranked:
            return {"in_scope": [], "out_of_scope": [{"point": "No relevant documents found.", "source": None}], "future_scope": []}
        return await run_analysis(
            requirements=criteria,
            chunks=reranked,
            anthropic_client=anthropic_client,
            client_name=client_name,
        )

    result_a, result_b = await _asyncio.gather(
        _run_single(clean_a, body.client_a),
        _run_single(clean_b, body.client_b),
    )

    return CompareResponse(
        client_a=body.client_a,
        client_b=body.client_b,
        result_a=result_a,
        result_b=result_b,
        created_at=datetime.now(timezone.utc).isoformat(),
    )
