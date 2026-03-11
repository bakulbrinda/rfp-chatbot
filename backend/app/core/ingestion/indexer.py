import hashlib
import math
import re
import uuid
from collections import Counter

import cohere
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    FieldCondition,
    Filter,
    MatchValue,
    PointStruct,
    SparseVector,
)
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ingestion.chunker import ChunkPayload
from app.core.rag.embedder import embed_texts


def _build_sparse_vector(text: str) -> SparseVector:
    """TF-IDF-style sparse vector for BM25 approximation.
    Uses a dict to accumulate scores per index, preventing duplicate indices
    that would cause Qdrant 422 validation errors on hash collisions.
    """
    tokens = re.findall(r"\b\w+\b", text.lower())
    if not tokens:
        return SparseVector(indices=[0], values=[0.0])

    tf = Counter(tokens)
    total = len(tokens)

    # Accumulate into dict to deduplicate colliding hash indices
    index_scores: dict[int, float] = {}
    for token, count in tf.items():
        idx = abs(hash(token) % 65536)
        tf_score = count / total
        idf_approx = math.log(1 + 1 / count)
        index_scores[idx] = index_scores.get(idx, 0.0) + float(tf_score * idf_approx)

    return SparseVector(
        indices=list(index_scores.keys()),
        values=list(index_scores.values()),
    )


async def index_chunks(
    chunks: list[ChunkPayload],
    qdrant_client: AsyncQdrantClient,
    cohere_client: cohere.AsyncClient,
    collection_name: str,
) -> int:
    """Embed and upsert chunks into Qdrant. Returns number of indexed chunks."""
    if not chunks:
        return 0

    child_texts = [c.child_text for c in chunks]
    dense_vectors = await embed_texts(child_texts, cohere_client, input_type="search_document")

    points: list[PointStruct] = []
    for chunk, dense_vec in zip(chunks, dense_vectors):
        sparse_vec = _build_sparse_vector(chunk.child_text)
        chunk_hash = hashlib.sha256(chunk.child_text.encode()).hexdigest()
        payload = {
            "doc_id": chunk.doc_id,
            "doc_name": chunk.doc_name,
            "doc_type": chunk.doc_type,
            "category": chunk.category,
            "section": chunk.section,
            "page_number": chunk.page_number,
            "chunk_index": chunk.chunk_index,
            "child_text": chunk.child_text,
            "parent_text": chunk.parent_text,
            "date_ingested": chunk.date_ingested,
            "content_type": chunk.content_type,
            "chunk_hash": chunk_hash,
        }
        points.append(
            PointStruct(
                id=str(uuid.uuid4()),
                vector={"dense": dense_vec, "sparse": sparse_vec},
                payload=payload,
            )
        )

    # Upsert in batches of 100
    batch_size = 100
    for i in range(0, len(points), batch_size):
        await qdrant_client.upsert(
            collection_name=collection_name,
            points=points[i : i + batch_size],
        )

    return len(points)


async def delete_by_doc_id(
    doc_id: str,
    qdrant_client: AsyncQdrantClient,
    collection_name: str,
) -> None:
    """Delete all Qdrant points for a given document ID."""
    await qdrant_client.delete(
        collection_name=collection_name,
        points_selector=Filter(
            must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]
        ),
    )
