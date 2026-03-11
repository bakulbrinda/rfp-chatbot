import math
import re
from collections import Counter

import cohere
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    Fusion,
    FusionQuery,
    Prefetch,
    SparseVector,
)

from app.core.rag.embedder import embed_query


def _query_sparse_vector(text: str) -> SparseVector:
    tokens = re.findall(r"\b\w+\b", text.lower())
    if not tokens:
        return SparseVector(indices=[0], values=[0.0])
    tf = Counter(tokens)
    total = len(tokens)
    indices, values = [], []
    for token, count in tf.items():
        idx = hash(token) % 65536
        tf_score = count / total
        idf_approx = math.log(1 + 1 / count)
        indices.append(abs(idx))
        values.append(float(tf_score * idf_approx))
    return SparseVector(indices=indices, values=values)


async def hybrid_search(
    query: str,
    qdrant_client: AsyncQdrantClient,
    cohere_client: cohere.AsyncClient,
    collection_name: str,
    top_k: int = 20,
) -> list:
    """Hybrid dense + sparse BM25 search with Reciprocal Rank Fusion."""
    dense_vec = await embed_query(query, cohere_client)
    sparse_vec = _query_sparse_vector(query)

    results = await qdrant_client.query_points(
        collection_name=collection_name,
        prefetch=[
            Prefetch(query=dense_vec, using="dense", limit=top_k),
            Prefetch(query=sparse_vec, using="sparse", limit=top_k),
        ],
        query=FusionQuery(fusion=Fusion.RRF),
        limit=top_k,
        with_payload=True,
    )
    return results.points
