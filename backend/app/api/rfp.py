from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel
from qdrant_client import AsyncQdrantClient
import cohere

from app.config import settings
from app.core.utils.query_sanitizer import sanitize_query
from app.core.utils.rate_limiter import limiter
from app.dependencies import get_qdrant_client, get_cohere_client, get_anthropic_client, get_current_user
from app.models.db_models import User
from app.core.rag.retriever import hybrid_search
from app.core.rag.reranker import rerank
from app.core.llm.rfp_service import run_rfp_respond, run_rfp_generate

router = APIRouter()


class RFPRespondRequest(BaseModel):
    rfp_text: str


class RFPGenerateRequest(BaseModel):
    client_brief: str
    client_name: str | None = None


_COVERAGE_WARNING_THRESHOLD = 0.30  # warn when >30% of questions are unanswered


@router.post("/respond")
@limiter.limit("10/minute")
async def rfp_respond(
    request: Request,
    body: RFPRespondRequest,
    current_user: User = Depends(get_current_user),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
    anthropic_client: AsyncAnthropic = Depends(get_anthropic_client),
):
    clean_rfp = sanitize_query(body.rfp_text)
    if not clean_rfp:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="RFP text cannot be empty.")

    results = await hybrid_search(clean_rfp[:2000], qdrant_client, cohere_client, settings.QDRANT_COLLECTION, top_k=20)
    reranked = await rerank(clean_rfp[:500], results, cohere_client, top_n=12)

    raw_answers = await run_rfp_respond(clean_rfp, reranked, anthropic_client)

    # Tag each answer and split into answered / unanswered sections
    answered: list[dict] = []
    unanswered: list[dict] = []
    for item in raw_answers:
        item["not_in_kb"] = item.get("confidence") == "not_found"
        if item["not_in_kb"]:
            unanswered.append(item)
        else:
            answered.append(item)

    total = len(raw_answers)
    unanswered_ratio = len(unanswered) / total if total else 0.0
    coverage_warning = unanswered_ratio > _COVERAGE_WARNING_THRESHOLD

    return {
        "answered": answered,
        "unanswered": unanswered,
        "total": total,
        "answered_count": len(answered),
        "unanswered_count": len(unanswered),
        "coverage_warning": coverage_warning,
        "coverage_warning_message": (
            f"{len(unanswered)} of {total} questions ({unanswered_ratio:.0%}) could not be answered "
            "from the knowledge base. Consider uploading additional documentation."
        ) if coverage_warning else None,
    }


@router.post("/generate")
@limiter.limit("10/minute")
async def rfp_generate(
    request: Request,
    body: RFPGenerateRequest,
    current_user: User = Depends(get_current_user),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
    anthropic_client: AsyncAnthropic = Depends(get_anthropic_client),
):
    clean_brief = sanitize_query(body.client_brief)
    if not clean_brief:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client brief cannot be empty.")

    results = await hybrid_search(clean_brief[:2000], qdrant_client, cohere_client, settings.QDRANT_COLLECTION, top_k=25)
    reranked = await rerank(clean_brief[:500], results, cohere_client, top_n=15)

    rfp_doc = await run_rfp_generate(clean_brief, reranked, anthropic_client)
    return {"rfp": rfp_doc, "client_name": body.client_name}
