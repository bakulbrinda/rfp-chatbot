import re
from dataclasses import dataclass, field

import cohere
from anthropic import AsyncAnthropic
from qdrant_client import AsyncQdrantClient

from app.config import settings
from app.core.llm.claude_client import generate
from app.core.llm.confidence import compute_confidence
from app.core.llm.prompts import CHAT_SYSTEM_PROMPT
from app.core.rag.evaluator import evaluate
from app.core.rag.reranker import rerank
from app.core.rag.retriever import hybrid_search


FALLBACK_ANSWER = (
    "That specific detail isn't in my knowledge base right now — I'd recommend checking "
    "with the relevant iMocha team or the latest documentation."
)

# Patterns that indicate a purely conversational message (no KB lookup needed)
_CONVERSATIONAL = re.compile(
    r"^\s*(hi|hello|hey|thanks?|thank you|cheers|great|ok|okay|cool|got it|"
    r"sounds good|perfect|sure|bye|goodbye|see you|good morning|good afternoon|"
    r"good evening|how are you|what('s| is) up)\W*$",
    re.IGNORECASE,
)


@dataclass
class ChatPipelineResult:
    found: bool
    answer: str = FALLBACK_ANSWER
    citations: list = field(default_factory=list)
    confidence: str = "not_found"


async def run_chat_pipeline(
    query: str,
    qdrant_client: AsyncQdrantClient,
    cohere_client: cohere.AsyncClient,
    anthropic_client: AsyncAnthropic,
    system_prompt: str = CHAT_SYSTEM_PROMPT,
    history: list[dict] | None = None,
) -> ChatPipelineResult:
    """
    Full CRAG pipeline with conversation history support:
    Conversational bypass → Retrieve → Rerank → Evaluate (gate) → Generate → Score
    """
    # Short-circuit: purely conversational inputs skip KB lookup
    if _CONVERSATIONAL.match(query.strip()):
        result = await generate(query, [], system_prompt, anthropic_client, history)
        return ChatPipelineResult(
            found=True,
            answer=result["text"],
            citations=[],
            confidence="high",
        )

    # Step 1: Hybrid retrieval
    raw_results = await hybrid_search(
        query,
        qdrant_client,
        cohere_client,
        settings.QDRANT_COLLECTION,
        top_k=settings.RETRIEVAL_TOP_K,
    )
    if not raw_results:
        # No vectors found at all — let Claude respond gracefully with history
        result = await generate(query, [], system_prompt, anthropic_client, history)
        return ChatPipelineResult(
            found=False,
            answer=result["text"],
            citations=[],
            confidence="not_found",
        )

    # Step 2: Rerank
    reranked = await rerank(
        query, raw_results, cohere_client, top_n=settings.RERANK_TOP_N
    )

    # Step 3: CRAG gate
    passed, relevant = evaluate(reranked)
    if not passed:
        # Chunks exist but below relevance threshold — answer conversationally
        result = await generate(query, [], system_prompt, anthropic_client, history)
        return ChatPipelineResult(
            found=False,
            answer=result["text"],
            citations=[],
            confidence="not_found",
        )

    # Step 4: Generate with context + history
    result = await generate(query, relevant, system_prompt, anthropic_client, history)

    # Step 5: Confidence from rerank scores
    scores = [score for _, score in relevant]
    confidence = compute_confidence(scores)

    return ChatPipelineResult(
        found=True,
        answer=result["text"],
        citations=result["citations"],
        confidence=confidence,
    )
