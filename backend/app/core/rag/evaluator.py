from app.config import settings


def evaluate(reranked: list[tuple]) -> tuple[bool, list]:
    """
    CRAG gate: filter chunks above relevance threshold.
    Returns (passed, relevant_chunks).
    If no chunks pass → (False, []) → triggers fallback, NO LLM call.
    """
    threshold = settings.CRAG_RELEVANCE_THRESHOLD
    above = [(chunk, score) for chunk, score in reranked if score >= threshold]
    if not above:
        return False, []
    return True, above
