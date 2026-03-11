from collections.abc import AsyncIterator

from anthropic import AsyncAnthropic
from qdrant_client.models import ScoredPoint


def _extract_citations(text: str, chunks: list[tuple[ScoredPoint, float]]) -> list[dict]:
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
    return citations


async def generate_stream(
    query: str,
    chunks: list[tuple[ScoredPoint, float]],
    system_prompt: str,
    anthropic_client: AsyncAnthropic,
    history: list[dict] | None = None,
) -> AsyncIterator[tuple[str, str, list[dict]]]:
    """
    Stream Claude response token by token.
    Yields ("token", text, []) for each chunk, then ("done", full_text, citations) at end.
    """
    context_parts = []
    for i, (chunk, score) in enumerate(chunks, 1):
        payload = chunk.payload or {}
        doc_name = payload.get("doc_name", "Unknown")
        section = payload.get("section", "")
        text = payload.get("parent_text", payload.get("child_text", ""))
        context_parts.append(f"[{i}] {doc_name}{' — ' + section if section else ''}\n{text}")

    context = "\n\n---\n\n".join(context_parts)
    messages: list[dict] = []

    if history:
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})

    user_content = (
        f"<knowledge_base>\n{context}\n</knowledge_base>\n\n{query}"
        if context_parts else query
    )
    messages.append({"role": "user", "content": user_content})

    full_text = ""
    async with anthropic_client.messages.stream(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=system_prompt,
        messages=messages,
    ) as stream:
        async for token in stream.text_stream:
            full_text += token
            yield "token", token, []

    citations = _extract_citations(full_text, chunks)
    yield "done", full_text, citations


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

    citations = _extract_citations(text, chunks)
    return {"text": text, "citations": citations}
