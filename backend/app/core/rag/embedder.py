import asyncio
from typing import Literal

import cohere

EMBED_MODEL = "embed-english-v3.0"
EMBED_DIMS = 1024
BATCH_SIZE = 96


async def embed_texts(
    texts: list[str],
    cohere_client: cohere.AsyncClient,
    input_type: Literal["search_document", "search_query"] = "search_document",
) -> list[list[float]]:
    """Embed a list of texts using Cohere, batched to avoid rate limits."""
    all_embeddings: list[list[float]] = []

    for i in range(0, len(texts), BATCH_SIZE):
        batch = texts[i : i + BATCH_SIZE]
        response = await cohere_client.embed(
            texts=batch,
            model=EMBED_MODEL,
            input_type=input_type,
            embedding_types=["float"],
        )
        all_embeddings.extend(response.embeddings.float_)

    return all_embeddings


async def embed_query(query: str, cohere_client: cohere.AsyncClient) -> list[float]:
    """Embed a single query string."""
    result = await embed_texts([query], cohere_client, input_type="search_query")
    return result[0]
