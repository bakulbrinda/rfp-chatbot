from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from qdrant_client import AsyncQdrantClient
import cohere

from app.config import settings
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


@router.post("/respond")
async def rfp_respond(
    body: RFPRespondRequest,
    current_user: User = Depends(get_current_user),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
    anthropic_client: AsyncAnthropic = Depends(get_anthropic_client),
):
    if not body.rfp_text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="RFP text cannot be empty.")

    results = await hybrid_search(body.rfp_text[:2000], qdrant_client, cohere_client, settings.QDRANT_COLLECTION, top_k=20)
    reranked = await rerank(body.rfp_text[:500], results, cohere_client, top_n=12)

    answers = await run_rfp_respond(body.rfp_text, reranked, anthropic_client)
    return {"answers": answers, "total": len(answers)}


@router.post("/generate")
async def rfp_generate(
    body: RFPGenerateRequest,
    current_user: User = Depends(get_current_user),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
    anthropic_client: AsyncAnthropic = Depends(get_anthropic_client),
):
    if not body.client_brief.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Client brief cannot be empty.")

    results = await hybrid_search(body.client_brief[:2000], qdrant_client, cohere_client, settings.QDRANT_COLLECTION, top_k=25)
    reranked = await rerank(body.client_brief[:500], results, cohere_client, top_n=15)

    rfp_doc = await run_rfp_generate(body.client_brief, reranked, anthropic_client)
    return {"rfp": rfp_doc, "client_name": body.client_name}
