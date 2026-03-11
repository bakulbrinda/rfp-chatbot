import json
from anthropic import AsyncAnthropic
from qdrant_client.models import ScoredPoint

from app.core.llm.prompts import ANALYSIS_SYSTEM_PROMPT


async def run_analysis(
    requirements: str,
    chunks: list[tuple[ScoredPoint, float]],
    anthropic_client: AsyncAnthropic,
    client_name: str | None = None,
) -> dict:
    """
    Analyse client requirements against the KB.
    Returns {"in_scope": [...], "out_of_scope": [...], "future_scope": [...]}
    """
    context_parts = []
    for i, (chunk, _) in enumerate(chunks, 1):
        payload = chunk.payload or {}
        doc_name = payload.get("doc_name", "Unknown")
        section = payload.get("section", "")
        text = payload.get("parent_text", payload.get("child_text", ""))
        context_parts.append(f"[{i}] {doc_name}{' — ' + section if section else ''}\n{text}")

    context = "\n\n---\n\n".join(context_parts)
    client_label = f" for {client_name}" if client_name else ""

    user_message = (
        f"<context>\n{context}\n</context>\n\n"
        f"<client_requirements{client_label}>\n{requirements}\n</client_requirements>\n\n"
        "Analyse these requirements against the iMocha knowledge base context above. "
        "Return ONLY the JSON object as specified."
    )

    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=3000,
        system=ANALYSIS_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip() if response.content else "{}"

    # Strip markdown code fences if present
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        result = {"in_scope": [], "out_of_scope": [], "future_scope": [], "raw": raw}

    return result
