import json
from anthropic import AsyncAnthropic
from qdrant_client.models import ScoredPoint

from app.core.llm.prompts import RFP_SYSTEM_PROMPT

RFP_RESPOND_PROMPT = """You are iMocha's pre-sales AI assistant.
Answer each RFP question using ONLY the provided knowledge base context.

Return a JSON array of objects:
[
  {
    "question": "The original question text",
    "answer": "Detailed answer grounded in the KB",
    "sources": ["doc_name / section", ...],
    "confidence": "high|medium|low|not_found"
  }
]

Rules:
1. Every answer must be grounded in the context. No invented facts.
2. If a question cannot be answered from the KB, set confidence to "not_found" and answer to
   "This information is not currently available in iMocha's knowledge base."
3. Return only valid JSON, no markdown fences."""


async def run_rfp_respond(
    rfp_text: str,
    chunks: list[tuple[ScoredPoint, float]],
    anthropic_client: AsyncAnthropic,
) -> list[dict]:
    """Parse RFP questions and answer each one from the KB."""
    context_parts = []
    for i, (chunk, _) in enumerate(chunks, 1):
        payload = chunk.payload or {}
        doc_name = payload.get("doc_name", "Unknown")
        section = payload.get("section", "")
        text = payload.get("parent_text", payload.get("child_text", ""))
        context_parts.append(f"[{i}] {doc_name}{' — ' + section if section else ''}\n{text}")

    context = "\n\n---\n\n".join(context_parts)

    user_message = (
        f"<context>\n{context}\n</context>\n\n"
        f"<rfp>\n{rfp_text}\n</rfp>\n\n"
        "Answer each question/requirement in the RFP using the KB context. "
        "Return ONLY the JSON array."
    )

    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=RFP_RESPOND_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip() if response.content else "[]"
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return []


async def run_rfp_generate(
    client_brief: str,
    chunks: list[tuple[ScoredPoint, float]],
    anthropic_client: AsyncAnthropic,
) -> dict:
    """Generate a full structured RFP response from a client brief."""
    context_parts = []
    for i, (chunk, _) in enumerate(chunks, 1):
        payload = chunk.payload or {}
        doc_name = payload.get("doc_name", "Unknown")
        section = payload.get("section", "")
        text = payload.get("parent_text", payload.get("child_text", ""))
        context_parts.append(f"[{i}] {doc_name}{' — ' + section if section else ''}\n{text}")

    context = "\n\n---\n\n".join(context_parts)

    user_message = (
        f"<context>\n{context}\n</context>\n\n"
        f"<client_brief>\n{client_brief}\n</client_brief>\n\n"
        "Generate a comprehensive RFP response using the KB context. "
        "Return ONLY the JSON object."
    )

    response = await anthropic_client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=4000,
        system=RFP_SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_message}],
    )

    raw = response.content[0].text.strip() if response.content else "{}"
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        return json.loads(raw)
    except json.JSONDecodeError:
        return {"raw": raw}
