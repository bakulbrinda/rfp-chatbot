import uuid
from datetime import datetime, timezone

import cohere
from anthropic import AsyncAnthropic
from fastapi import APIRouter, Depends, HTTPException, status
from qdrant_client import AsyncQdrantClient
from sqlalchemy import delete as sql_delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.llm.prompts import build_chat_system_prompt
from app.core.rag.pipeline import run_chat_pipeline
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
async def send_message(
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

    # Run RAG pipeline with conversation history and dynamic system prompt
    pipeline_result = await run_chat_pipeline(
        body.message, qdrant_client, cohere_client, anthropic_client,
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
