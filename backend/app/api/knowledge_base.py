import uuid
from pathlib import Path

import cohere
from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from qdrant_client import AsyncQdrantClient
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.dependencies import get_anthropic_client, get_cohere_client, get_current_user, get_qdrant_client, require_admin
from app.models.db_models import Document, User
from app.models.schemas import DocumentList, DocumentOut
from app.services.file_service import delete_file, run_ingestion, save_file
from app.core.ingestion.indexer import delete_by_doc_id

router = APIRouter(prefix="/api/kb", tags=["knowledge-base"])


@router.post("/upload", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    category: str = Form(default="General"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
):
    # Validate file type
    allowed = {"application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "text/plain"}
    if file.content_type not in allowed:
        raise HTTPException(status_code=400, detail="Only PDF, DOCX, and TXT files are supported")

    # Validate size — read once, pass content to save_file to avoid double-read issues
    content = await file.read()
    size_bytes = len(content)
    size_kb = size_bytes // 1024
    max_bytes = settings.MAX_FILE_SIZE_MB * 1024 * 1024
    if size_bytes > max_bytes:
        raise HTTPException(
            status_code=400,
            detail=f"File too large ({size_kb // 1024:.0f} MB). Maximum allowed size is {settings.MAX_FILE_SIZE_MB} MB.",
        )

    ext_map = {
        "application/pdf": "pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "text/plain": "txt",
    }
    file_type = ext_map.get(file.content_type, "txt")
    doc_id = str(uuid.uuid4())

    storage_url, _ = await save_file(file, doc_id, content)

    doc = Document(
        id=uuid.UUID(doc_id),
        filename=f"{doc_id}.{file_type}",
        original_name=file.filename or "unnamed",
        file_type=file_type,
        category=category,
        file_size_kb=size_kb,
        storage_url=storage_url,
        status="processing",
        uploaded_by=current_user.id,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)

    # Ingestion runs in background
    background_tasks.add_task(run_ingestion, storage_url, doc, db, qdrant_client, cohere_client)

    return DocumentOut.model_validate(doc)


@router.get("/files", response_model=DocumentList)
async def list_documents(
    skip: int = 0,
    limit: int = 50,
    category: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    query = select(Document)
    if category:
        query = query.where(Document.category == category)

    total_result = await db.execute(select(func.count()).select_from(Document))
    total = total_result.scalar_one()

    query = query.order_by(Document.uploaded_at.desc()).offset(skip).limit(limit)
    result = await db.execute(query)
    docs = result.scalars().all()

    return DocumentList(items=[DocumentOut.model_validate(d) for d in docs], total=total)


@router.get("/files/{doc_id}", response_model=DocumentOut)
async def get_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return DocumentOut.model_validate(doc)


@router.get("/files/{doc_id}/preview")
async def preview_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    _: User = Depends(get_current_user),
):
    result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Fetch first chunk payload from Qdrant for preview
    from qdrant_client.models import FieldCondition, Filter, MatchValue

    points = await qdrant_client.scroll(
        collection_name=settings.QDRANT_COLLECTION,
        scroll_filter=Filter(must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]),
        limit=5,
        with_payload=True,
    )
    if points[0]:
        text = " ".join(p.payload.get("parent_text", "") for p in points[0])
        return {"text": text[:2000]}

    return {"text": "Preview not available — document may still be processing."}


@router.put("/files/{doc_id}", response_model=DocumentOut)
async def reindex_document(
    doc_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
    cohere_client: cohere.AsyncClient = Depends(get_cohere_client),
):
    result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Delete old Qdrant chunks
    await delete_by_doc_id(doc_id, qdrant_client, settings.QDRANT_COLLECTION)

    doc.status = "processing"
    doc.chunk_count = 0
    await db.commit()

    background_tasks.add_task(run_ingestion, doc.storage_url, doc, db, qdrant_client, cohere_client)
    await db.refresh(doc)
    return DocumentOut.model_validate(doc)


@router.delete("/files/{doc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    doc_id: str,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
    qdrant_client: AsyncQdrantClient = Depends(get_qdrant_client),
):
    result = await db.execute(select(Document).where(Document.id == uuid.UUID(doc_id)))
    doc = result.scalar_one_or_none()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    # Always delete from Qdrant first
    await delete_by_doc_id(doc_id, qdrant_client, settings.QDRANT_COLLECTION)
    await delete_file(doc.storage_url)
    await db.delete(doc)
    await db.commit()


@router.get("/suggestions")
async def get_kb_suggestions(
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Get active KB gap suggestions (admin only)."""
    from app.models.db_models import KBSuggestion
    result = await db.execute(
        select(KBSuggestion)
        .where(KBSuggestion.dismissed == False)  # noqa: E712
        .order_by(KBSuggestion.query_count.desc())
    )
    suggestions = result.scalars().all()
    return [
        {
            "id": str(s.id),
            "topic": s.topic,
            "query_count": s.query_count,
            "examples": s.examples,
            "generated_at": s.generated_at.isoformat(),
        }
        for s in suggestions
    ]


@router.post("/suggestions/{suggestion_id}/dismiss", status_code=204)
async def dismiss_kb_suggestion(
    suggestion_id: str,
    _: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    """Dismiss a KB suggestion (admin only)."""
    import uuid as _uuid
    from app.models.db_models import KBSuggestion
    result = await db.execute(
        select(KBSuggestion).where(KBSuggestion.id == _uuid.UUID(suggestion_id))
    )
    suggestion = result.scalar_one_or_none()
    if suggestion:
        suggestion.dismissed = True
        await db.commit()
