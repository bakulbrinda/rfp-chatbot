from anthropic import AsyncAnthropic
from qdrant_client.models import ScoredPoint


async def generate(
    query: str,
    chunks: list[tuple[ScoredPoint, float]],
    system_prompt: str,
    anthropic_client: AsyncAnthropic,
    history: list[dict] | None = None,
) -> dict:
    """
    Call Claude with grounded context chunks and optional conversation history.
    Returns {"text": str, "citations": list[dict]}
    """
    # Build context block
    context_parts = []
    for i, (chunk, score) in enumerate(chunks, 1):
        payload = chunk.payload or {}
        doc_name = payload.get("doc_name", "Unknown")
        section = payload.get("section", "")
        text = payload.get("parent_text", payload.get("child_text", ""))
        context_parts.append(f"[{i}] {doc_name}{' — ' + section if section else ''}\n{text}")

    context = "\n\n---\n\n".join(context_parts)

    # Build messages — inject history then current turn
    messages: list[dict] = []

    if history:
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})

    if context_parts:
        user_content = (
            f"<knowledge_base>\n{context}\n</knowledge_base>\n\n"
            f"{query}"
        )
    else:
        # No relevant KB context — let Claude handle conversationally
        user_content = query

    messages.append({"role": "user", "content": user_content})

    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=system_prompt,
        messages=messages,
    )

    text = response.content[0].text if response.content else ""

    # Extract inline citations from chunks that were actually referenced
    citations = []
    for i, (chunk, _) in enumerate(chunks, 1):
        if f"[{i}]" in text:
            payload = chunk.payload or {}
            citations.append({
                "doc_name": payload.get("doc_name", "Unknown"),
                "section": payload.get("section", ""),
                "page_number": None,
                "quote": payload.get("child_text", "")[:200],
            })

    return {"text": text, "citations": citations}
