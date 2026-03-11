import os
import shutil
import uuid
from pathlib import Path

import cohere
from fastapi import UploadFile
from qdrant_client import AsyncQdrantClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.ingestion.chunker import chunk_elements
from app.core.ingestion.indexer import delete_by_doc_id, index_chunks
from app.core.ingestion.parser import parse_document
from app.models.db_models import Document


async def save_file(file: UploadFile, doc_id: str, content: bytes | None = None) -> tuple[str, int]:
    """
    Save uploaded file to local storage or S3.
    Pass pre-read `content` bytes to avoid double-reading the stream.
    Returns (storage_url, file_size_kb).
    """
    if content is None:
        content = await file.read()
    if settings.STORAGE_BACKEND == "s3":
        return await _save_to_s3(file, doc_id, content)
    return await _save_local(file, doc_id, content)


async def _save_local(file: UploadFile, doc_id: str, content: bytes) -> tuple[str, int]:
    upload_dir = Path(settings.LOCAL_UPLOAD_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)

    ext = Path(file.filename or "file").suffix
    filename = f"{doc_id}{ext}"
    file_path = upload_dir / filename

    file_path.write_bytes(content)

    size_kb = len(content) // 1024
    return str(file_path), size_kb


async def _save_to_s3(file: UploadFile, doc_id: str, content: bytes) -> tuple[str, int]:
    import boto3

    ext = Path(file.filename or "file").suffix
    key = f"documents/{doc_id}{ext}"

    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )
    s3.put_object(Bucket=settings.AWS_S3_BUCKET, Key=key, Body=content)
    url = f"s3://{settings.AWS_S3_BUCKET}/{key}"
    return url, len(content) // 1024



async def delete_file(storage_url: str) -> None:
    if storage_url.startswith("s3://"):
        _delete_from_s3(storage_url)
    else:
        try:
            Path(storage_url).unlink(missing_ok=True)
        except Exception:
            pass


def _delete_from_s3(storage_url: str) -> None:
    import boto3

    parts = storage_url.replace("s3://", "").split("/", 1)
    bucket, key = parts[0], parts[1]
    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )
    s3.delete_object(Bucket=bucket, Key=key)


async def run_ingestion(
    storage_url: str,
    doc: Document,
    db: AsyncSession,
    qdrant_client: AsyncQdrantClient,
    cohere_client: cohere.AsyncClient,
) -> None:
    """
    Full ingestion pipeline: parse → chunk → embed → index Qdrant → update DB status.
    Runs as a FastAPI background task.
    """
    try:
        doc_id = str(doc.id)

        # Parse
        elements = parse_document(storage_url, doc_id)

        # Chunk
        chunks = chunk_elements(
            elements,
            doc_name=doc.original_name,
            doc_type=doc.file_type,
            category=doc.category,
        )

        # Index
        count = await index_chunks(chunks, qdrant_client, cohere_client, settings.QDRANT_COLLECTION)

        # Update DB
        doc.chunk_count = count
        doc.status = "indexed"
        await db.commit()

    except Exception as exc:
        doc.status = "failed"
        await db.commit()
        raise exc
