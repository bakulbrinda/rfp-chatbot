import json
import uuid
from datetime import datetime, timezone

import cohere
from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from qdrant_client import AsyncQdrantClient
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.utils.rate_limiter import limiter
from app.core.llm.claude_client import generate_stream
from app.core.llm.confidence import compute_confidence
from app.core.llm.prompts import build_chat_system_prompt
from app.core.rag.evaluator import evaluate
from app.core.rag.pipeline import FALLBACK_ANSWER, run_chat_pipeline
from app.core.rag.reranker import rerank
from app.core.rag.retriever import hybrid_search
from app.core.utils.query_sanitizer import sanitize_query
from app.db.session import get_db
from app.dependencies import get_anthropic_client, get_cohere_client, get_current_user, get_qdrant_client
from app.models.db_models import BotConfig, ChatMessage, ChatSession, QueryLog, User
from app.models.schemas import (
    ChatMessageOut,
    ChatRequest,
    ChatResponse,
    ChatSessionOut,
    SessionWithMessages,
)

router = APIRouter(prefix="/api/chat", tags=["chat"])


@router.post("", response_model=ChatResponse)
@limiter.limit("30/minute")
async def send_message(
    request: Request,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
    anthropic_client: AsyncAnthropic = Depends(get_anthropic_client),
):
    # Get or create session
    session: ChatSession | None = None
    if body.session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == uuid.UUID(body.session_id),
                ChatSession.user_id == current_user.id,
            )
        )
        session = result.scalar_one_or_none()

    if not session:
        session = ChatSession(user_id=current_user.id, title=body.message[:60])
        db.add(session)
        await db.flush()

    # Load bot config (single row, fast PK lookup)
    bot_cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
    system_prompt = build_chat_system_prompt(
        bot_name=bot_cfg.bot_name if bot_cfg else "Maya",
        custom_instructions=bot_cfg.instructions if bot_cfg else None,
    )

    # Fetch last 6 messages (3 turns) for conversation history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(6)
    )
    recent_messages = list(reversed(history_result.scalars().all()))
    history = [{"role": m.role, "content": m.content} for m in recent_messages]

    # Save user message
    user_msg = ChatMessage(
        session_id=session.id,
        role="user",
        content=body.message,
    )
    db.add(user_msg)

    # Sanitize query before retrieval and generation
    clean_message = sanitize_query(body.message)
    if not clean_message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid query.")

    # Run RAG pipeline with conversation history and dynamic system prompt
    pipeline_result = await run_chat_pipeline(
        clean_message, qdrant_client, cohere_client, anthropic_client,
        system_prompt=system_prompt,
        history=history or None,
    )

    # Save assistant message
    assistant_msg = ChatMessage(
        session_id=session.id,
        role="assistant",
        content=pipeline_result.answer,
        citations=[c if isinstance(c, dict) else c.__dict__ for c in pipeline_result.citations],
        confidence=pipeline_result.confidence,
    )
    db.add(assistant_msg)

    # Log query for analytics
    log = QueryLog(
        session_id=session.id,
        user_id=current_user.id,
        query_text=body.message,
        answer_found=pipeline_result.found,
        confidence=pipeline_result.confidence if pipeline_result.found else None,
        module="chat",
    )
    db.add(log)

    # Update session timestamp
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()

    from app.models.schemas import Citation
    citations = [
        Citation(
            doc_name=c.get("doc_name", ""),
            section=c.get("section", ""),
            page_number=c.get("page_number"),
            quote=c.get("quote", ""),
        )
        for c in pipeline_result.citations
    ]

    return ChatResponse(
        session_id=str(session.id),
        answer=pipeline_result.answer,
        citations=citations,
        confidence=pipeline_result.confidence,
    )


@router.post("/stream")
@limiter.limit("30/minute")
async def stream_message(
    request: Request,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
    anthropic_client: AsyncAnthropic = Depends(get_anthropic_client),
):
    """SSE streaming endpoint. Events: start | token | done | error"""

    # Resolve session
    session: ChatSession | None = None
    if body.session_id:
        result = await db.execute(
            select(ChatSession).where(
                ChatSession.id == uuid.UUID(body.session_id),
                ChatSession.user_id == current_user.id,
            )
        )
        session = result.scalar_one_or_none()

    if not session:
        session = ChatSession(user_id=current_user.id, title=body.message[:60])
        db.add(session)
        await db.flush()

    # Bot config + system prompt
    bot_cfg = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
    system_prompt = build_chat_system_prompt(
        bot_name=bot_cfg.bot_name if bot_cfg else "Maya",
        custom_instructions=bot_cfg.instructions if bot_cfg else None,
    )

    # Conversation history
    history_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.desc())
        .limit(6)
    )
    recent = list(reversed(history_result.scalars().all()))
    history = [{"role": m.role, "content": m.content} for m in recent] or None

    # Sanitize before saving or processing
    clean_message = sanitize_query(body.message)
    if not clean_message:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid query.")

    # Save user message
    user_msg = ChatMessage(session_id=session.id, role="user", content=clean_message)
    db.add(user_msg)
    session.updated_at = datetime.now(timezone.utc)
    await db.commit()

    session_id_str = str(session.id)

    async def event_generator():
        try:
            yield f"data: {json.dumps({'type': 'start', 'session_id': session_id_str})}\n\n"

            # RAG retrieval
            from app.core.rag.pipeline import _CONVERSATIONAL
            if _CONVERSATIONAL.match(clean_message.strip()):
                relevant: list = []
                found = True
            else:
                raw = await hybrid_search(
                    clean_message, qdrant_client, cohere_client,
                    settings.QDRANT_COLLECTION, top_k=settings.RETRIEVAL_TOP_K,
                )
                if raw:
                    reranked = await rerank(clean_message, raw, cohere_client, top_n=settings.RERANK_TOP_N)
                    passed, relevant = evaluate(reranked)
                    found = passed
                    if not passed:
                        relevant = []
                else:
                    relevant = []
                    found = False

            # Hard stop — no LLM call when KB has nothing relevant
            if not found and not _CONVERSATIONAL.match(clean_message.strip()):
                db.add(QueryLog(
                    session_id=session.id,
                    user_id=current_user.id,
                    query_text=clean_message,
                    answer_found=False,
                    confidence=None,
                    module="chat",
                ))
                db.add(ChatMessage(
                    session_id=session.id,
                    role="assistant",
                    content=FALLBACK_ANSWER,
                    citations=[],
                    confidence="not_found",
                ))
                await db.commit()
                yield f"data: {json.dumps({'type': 'token', 'text': FALLBACK_ANSWER})}\n\n"
                yield f"data: {json.dumps({'type': 'done', 'citations': [], 'confidence': 'not_found', 'found': False})}\n\n"
                return

            # Stream Claude response
            full_text = ""
            citations: list = []
            async for event_type, text, event_citations in generate_stream(
                clean_message, relevant, system_prompt, anthropic_client, history
            ):
                if event_type == "token":
                    full_text += text
                    yield f"data: {json.dumps({'type': 'token', 'text': text})}\n\n"
                elif event_type == "done":
                    citations = event_citations

            confidence = compute_confidence([s for _, s in relevant]) if relevant else "not_found"

            # Save assistant message + query log
            assistant_msg = ChatMessage(
                session_id=session.id,
                role="assistant",
                content=full_text,
                citations=citations,
                confidence=confidence,
            )
            db.add(assistant_msg)
            db.add(QueryLog(
                session_id=session.id,
                user_id=current_user.id,
                query_text=clean_message,
                answer_found=found,
                confidence=confidence if found else None,
                module="chat",
            ))
            await db.commit()

            yield f"data: {json.dumps({'type': 'done', 'citations': citations, 'confidence': confidence, 'found': found})}\n\n"

        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.get("/sessions", response_model=list[ChatSessionOut])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession)
        .where(ChatSession.user_id == current_user.id)
        .order_by(ChatSession.updated_at.desc())
        .limit(50)
    )
    return [ChatSessionOut.model_validate(s) for s in result.scalars().all()]


@router.get("/sessions/{session_id}", response_model=SessionWithMessages)
async def get_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == uuid.UUID(session_id),
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    msgs_result = await db.execute(
        select(ChatMessage)
        .where(ChatMessage.session_id == session.id)
        .order_by(ChatMessage.created_at.asc())
    )
    messages = [ChatMessageOut.model_validate(m) for m in msgs_result.scalars().all()]

    return SessionWithMessages(
        session=ChatSessionOut.model_validate(session),
        messages=messages,
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(ChatSession).where(
            ChatSession.id == uuid.UUID(session_id),
            ChatSession.user_id == current_user.id,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    # Delete child rows first to avoid FK violations
    await db.execute(sql_delete(QueryLog).where(QueryLog.session_id == session.id))
    await db.execute(sql_delete(ChatMessage).where(ChatMessage.session_id == session.id))
    await db.delete(session)
    await db.commit()
