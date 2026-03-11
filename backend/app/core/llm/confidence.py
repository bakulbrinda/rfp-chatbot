def compute_confidence(rerank_scores: list[float]) -> str:
    if not rerank_scores:
        return "not_found"
    top = max(rerank_scores)
    if top >= 0.85:
        return "high"
    elif top >= 0.60:
        return "medium"
    return "low"
