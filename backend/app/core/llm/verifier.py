"""
Post-generation Haiku verification layer.

After Claude generates a response, this module checks every factual claim
against the source chunks that were retrieved. Unsupported sentences are
stripped and replaced with a notice. If all content is stripped, the full
hard-stop fallback fires.

Design notes:
- Uses claude-haiku-4-5-20251001 (fast, cheap, < 500ms typical latency)
- Conservative: only flags claims with NO possible support in any source chunk
- On any verification error, fails open (returns original text) so users are
  never blocked by a verifier failure
- Skips verification when no KB context was used (conversational responses)
"""

import json
import logging

from anthropic import AsyncAnthropic
from qdrant_client.models import ScoredPoint

_log = logging.getLogger(__name__)

HAIKU_MODEL = "claude-haiku-4-5-20251001"
VERIFIED_NOTICE = "I was unable to verify this detail from my knowledge base."
FULL_FALLBACK = (
    "I don't have this information in my knowledge base. "
    "Please contact your admin if this is something that should be covered."
)

_VERIFICATION_SYSTEM = """You are a factual accuracy verifier for an enterprise AI assistant.
Your job is to check whether the response contains factual claims not supported by the provided knowledge base sources.

Rules:
1. Only flag a sentence as unsupported if it contains a factual claim that has absolutely NO basis in ANY of the provided source chunks.
2. Do NOT flag sentences that are reasonable paraphrases or summaries of what the sources say.
3. Do NOT flag conversational phrases, greetings, or transition sentences with no factual content.
4. Do NOT flag sentences like "I don't have information about X" or "this is not covered in my knowledge base".
5. A claim is supported if ANY source chunk contains relevant information that justifies it — even indirectly.

Return ONLY valid JSON in exactly this format, no markdown fences:
{"verified": true, "unsupported_sentences": []}
or
{"verified": false, "unsupported_sentences": ["exact sentence 1", "exact sentence 2"]}"""


def _build_verification_prompt(
    response_text: str,
    chunks: list[tuple[ScoredPoint, float]],
) -> str:
    context_parts = []
    for i, (chunk, _) in enumerate(chunks, 1):
        payload = chunk.payload or {}
        doc_name = payload.get("doc_name", "Unknown")
        section = payload.get("section", "")
        text = payload.get("parent_text", payload.get("child_text", ""))
        context_parts.append(
            f"[{i}] {doc_name}{' — ' + section if section else ''}\n{text}"
        )

    context = "\n\n---\n\n".join(context_parts)
    return (
        f"<knowledge_base_sources>\n{context}\n</knowledge_base_sources>\n\n"
        f"<response_to_verify>\n{response_text}\n</response_to_verify>\n\n"
        "Check the response against the sources and return the JSON result."
    )


def _strip_unsupported(text: str, unsupported: list[str]) -> str:
    """Remove unsupported sentences from the response text."""
    result = text
    for sentence in unsupported:
        sentence = sentence.strip()
        if sentence and sentence in result:
            result = result.replace(sentence, VERIFIED_NOTICE)
    # Collapse duplicate notices
    import re
    result = re.sub(
        rf"({re.escape(VERIFIED_NOTICE)}\s*){{2,}}",
        VERIFIED_NOTICE + " ",
        result,
    )
    return result.strip()


async def verify_response(
    response_text: str,
    chunks: list[tuple[ScoredPoint, float]],
    anthropic_client: AsyncAnthropic,
) -> tuple[str, bool, int]:
    """
    Verify response against source chunks using Claude Haiku.

    Returns:
        (verified_text, all_content_stripped, unsupported_count)

    - verified_text: cleaned response (unsupported sentences replaced with notice)
    - all_content_stripped: True if everything was stripped → caller should use FULL_FALLBACK
    - unsupported_count: number of sentences that were stripped (for audit logging)

    Fails open on any error (returns original text, verified=False, count=0).
    """
    # Skip verification if no KB context was used
    if not chunks:
        return response_text, False, 0

    # Skip very short responses (greetings, one-liners under 20 chars)
    if len(response_text.strip()) < 20:
        return response_text, False, 0

    try:
        prompt = _build_verification_prompt(response_text, chunks)
        haiku_response = await anthropic_client.messages.create(
            model=HAIKU_MODEL,
            max_tokens=512,
            system=_VERIFICATION_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )

        raw = haiku_response.content[0].text.strip() if haiku_response.content else ""

        # Strip markdown fences if Haiku added them despite instructions
        if raw.startswith("```"):
            raw = raw.split("```")[1]
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()

        result = json.loads(raw)
        verified: bool = result.get("verified", True)
        unsupported: list[str] = result.get("unsupported_sentences", [])

        if verified or not unsupported:
            return response_text, False, 0

        stripped = _strip_unsupported(response_text, unsupported)

        # If stripping removed nearly everything, fire full fallback
        remaining = stripped.replace(VERIFIED_NOTICE, "").strip()
        if len(remaining) < 30:
            return FULL_FALLBACK, True, len(unsupported)

        return stripped, False, len(unsupported)

    except Exception as exc:
        # Fail open — log but don't block the user
        _log.warning("Verifier error (failing open): %s", exc)
        return response_text, False, 0
