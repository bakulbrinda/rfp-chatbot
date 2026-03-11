import asyncio

import cohere
from app.config import settings


async def rerank(
    query: str,
    results: list,
    cohere_client: cohere.AsyncClient,
    top_n: int = 5,
) -> list[tuple]:
    """Rerank retrieved chunks using Cohere rerank-english-v3.0."""
    if not results:
        return []

    docs = [r.payload.get("child_text", "") for r in results]

    def _rerank_sync():
        import cohere as _cohere
        sync_client = _cohere.Client(api_key=settings.COHERE_API_KEY)
        return sync_client.rerank(
            model="rerank-english-v3.0",
            query=query,
            documents=docs,
            top_n=min(top_n, len(docs)),
            return_documents=True,
        )

    reranked = await asyncio.to_thread(_rerank_sync)

    return [
        (results[r.index], r.relevance_score)
        for r in reranked.results
    ]
