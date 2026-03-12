"""
RFP Analyzer pipeline — 3 sequential Claude calls.

Call order is NON-NEGOTIABLE (spec rule 9.1):
  #1 Client profile extraction  → sets context for everything
  #2 Requirements extraction    → produces the list #3 classifies
  #3 Scope classification       → depends on output of #2

Each call:
  - Validates Claude's JSON with Pydantic before persisting
  - Retries once with a corrective prompt on parse failure (spec rule 9.7)
  - Stores raw Claude response for auditability (spec rule 9.2)
  - Writes partial results to DB so status polling shows progress
"""
import json
import uuid
import structlog
from typing import Any

from anthropic import AsyncAnthropic
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.db_models import RFPAnalysis, RFPRequirement, RFPClassification
from app.core.llm.prompts import (
    RFP_ANALYZER_PROFILE_PROMPT,
    RFP_ANALYZER_REQUIREMENTS_PROMPT,
    build_rfp_analyzer_classification_prompt,
)

logger = structlog.get_logger()

MODEL = "claude-sonnet-4-6"
MAX_TOKENS_PROFILE = 1024
MAX_TOKENS_REQUIREMENTS = 8192
MAX_TOKENS_CLASSIFICATIONS = 8192


# ── Pydantic validators for Claude JSON responses ─────────────────────────────

class ClientProfileResponse(BaseModel):
    client_name: str | None = None
    country: str | None = None
    sector: str | None = None
    tender_id: str | None = None
    submission_deadline: str | None = None
    evaluation_split: dict | None = None
    budget_indication: str | None = None
    currency: str | None = None
    language: str | None = None


class RequirementItem(BaseModel):
    req_id: str
    text: str
    raw_quote: str | None = None
    category: str | None = None
    priority: str | None = None
    source_page: int | None = None
    source_section: str | None = None


class ClassificationItem(BaseModel):
    req_id: str
    scope: str = Field(pattern=r"^(in|conditional|out)$")
    justification: str | None = None
    confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    conditions: str | None = None


# ── Core pipeline ─────────────────────────────────────────────────────────────

async def run_rfp_analyzer_pipeline(
    analysis_id: uuid.UUID,
    document_text: str,
    company_context: str | None,
    no_context: bool,
    db: AsyncSession,
    anthropic_client: AsyncAnthropic,
) -> None:
    """
    Entry point for the background pipeline. Updates RFPAnalysis.status as it goes.
    On any unrecoverable error, sets status='error' and writes error_message.
    """
    try:
        # Step 1
        await _run_profile_extraction(analysis_id, document_text, db, anthropic_client)
        # Step 2
        requirements = await _run_requirements_extraction(analysis_id, document_text, db, anthropic_client)
        # Step 3
        await _run_scope_classification(analysis_id, requirements, company_context, no_context, db, anthropic_client)

        # Mark complete
        await _update_analysis(db, analysis_id, {"status": "complete"})
        logger.info("rfp_pipeline_complete", analysis_id=str(analysis_id))

    except Exception as exc:
        logger.error("rfp_pipeline_error", analysis_id=str(analysis_id), error=str(exc))
        await _update_analysis(db, analysis_id, {
            "status": "error",
            "error_message": str(exc)[:1000],
        })


async def _run_profile_extraction(
    analysis_id: uuid.UUID,
    document_text: str,
    db: AsyncSession,
    anthropic_client: AsyncAnthropic,
) -> None:
    """AI call #1 — extract client metadata from document."""
    logger.info("rfp_profile_start", analysis_id=str(analysis_id))

    raw = await _call_claude(
        anthropic_client,
        system=RFP_ANALYZER_PROFILE_PROMPT,
        user_content=f"<document>\n{document_text}\n</document>",
        max_tokens=MAX_TOKENS_PROFILE,
    )

    profile = await _parse_with_retry(
        raw, ClientProfileResponse, anthropic_client,
        system=RFP_ANALYZER_PROFILE_PROMPT,
        user_content=f"<document>\n{document_text}\n</document>",
        max_tokens=MAX_TOKENS_PROFILE,
    )

    await _update_analysis(db, analysis_id, {
        "client_name": profile.client_name,
        "country": profile.country,
        "sector": profile.sector,
        "tender_id": profile.tender_id,
        "submission_deadline": profile.submission_deadline,
        "evaluation_split": profile.evaluation_split,
        "budget_indication": profile.budget_indication,
        "currency": profile.currency,
        "language": profile.language,
        "raw_profile_response": raw,
    })
    logger.info("rfp_profile_complete", analysis_id=str(analysis_id))


async def _run_requirements_extraction(
    analysis_id: uuid.UUID,
    document_text: str,
    db: AsyncSession,
    anthropic_client: AsyncAnthropic,
) -> list[RequirementItem]:
    """AI call #2 — extract all requirements. Returns list for use by step #3."""
    logger.info("rfp_requirements_start", analysis_id=str(analysis_id))

    raw = await _call_claude(
        anthropic_client,
        system=RFP_ANALYZER_REQUIREMENTS_PROMPT,
        user_content=f"<document>\n{document_text}\n</document>",
        max_tokens=MAX_TOKENS_REQUIREMENTS,
    )

    parsed_list = await _parse_list_with_retry(
        raw, RequirementItem, anthropic_client,
        system=RFP_ANALYZER_REQUIREMENTS_PROMPT,
        user_content=f"<document>\n{document_text}\n</document>",
        max_tokens=MAX_TOKENS_REQUIREMENTS,
    )

    # Persist requirements to DB
    for item in parsed_list:
        req = RFPRequirement(
            analysis_id=analysis_id,
            req_id=item.req_id,
            text=item.text,
            raw_quote=item.raw_quote,
            category=item.category,
            priority=item.priority,
            source_page=item.source_page,
            source_section=item.source_section,
        )
        db.add(req)

    await _update_analysis(db, analysis_id, {"raw_requirements_response": raw})
    await db.commit()
    logger.info("rfp_requirements_complete", analysis_id=str(analysis_id), count=len(parsed_list))

    return parsed_list


async def _run_scope_classification(
    analysis_id: uuid.UUID,
    requirements: list[RequirementItem],
    company_context: str | None,
    no_context: bool,
    db: AsyncSession,
    anthropic_client: AsyncAnthropic,
) -> None:
    """AI call #3 — classify each requirement against company capabilities."""
    logger.info("rfp_classification_start", analysis_id=str(analysis_id))

    # Build requirements JSON for the user message
    req_list_json = json.dumps([{"req_id": r.req_id, "text": r.text} for r in requirements], indent=2)

    system_prompt = build_rfp_analyzer_classification_prompt(company_context)

    raw = await _call_claude(
        anthropic_client,
        system=system_prompt,
        user_content=f"<requirements>\n{req_list_json}\n</requirements>",
        max_tokens=MAX_TOKENS_CLASSIFICATIONS,
    )

    parsed_list = await _parse_list_with_retry(
        raw, ClassificationItem, anthropic_client,
        system=system_prompt,
        user_content=f"<requirements>\n{req_list_json}\n</requirements>",
        max_tokens=MAX_TOKENS_CLASSIFICATIONS,
    )

    # Map classifications back to requirement DB rows
    result = await db.execute(
        select(RFPRequirement).where(RFPRequirement.analysis_id == analysis_id)
    )
    req_rows = {r.req_id: r for r in result.scalars().all()}

    for item in parsed_list:
        req_row = req_rows.get(item.req_id)
        if not req_row:
            continue  # Skip if req_id doesn't match (Claude hallucinated an ID)
        classification = RFPClassification(
            requirement_id=req_row.id,
            scope=item.scope,
            justification=item.justification,
            confidence=item.confidence,
            conditions=item.conditions,
            no_context=no_context,
        )
        db.add(classification)

    await _update_analysis(db, analysis_id, {"raw_classifications_response": raw})
    await db.commit()
    logger.info("rfp_classification_complete", analysis_id=str(analysis_id), count=len(parsed_list))


# ── Claude call helpers ───────────────────────────────────────────────────────

async def _call_claude(
    client: AsyncAnthropic,
    system: str,
    user_content: str,
    max_tokens: int,
) -> str:
    """Single Claude API call. Returns raw response text."""
    response = await client.messages.create(
        model=MODEL,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user_content}],
    )
    return response.content[0].text


async def _parse_with_retry(
    raw: str,
    model_class: type[BaseModel],
    client: AsyncAnthropic,
    system: str,
    user_content: str,
    max_tokens: int,
) -> Any:
    """
    Parse Claude's JSON response into model_class.
    On failure, retry once with a corrective prompt (spec rule 9.7).
    Raises ValueError on second failure.
    """
    try:
        data = json.loads(_extract_json(raw))
        return model_class(**data)
    except (json.JSONDecodeError, ValidationError) as first_err:
        logger.warning("claude_json_parse_retry", error=str(first_err))
        corrective = (
            f"Your previous response was not valid JSON. Error: {first_err}\n"
            f"Previous response: {raw[:500]}\n"
            "Respond ONLY with valid JSON matching the schema. No explanation."
        )
        retry_raw = await _call_claude(client, system=system,
                                        user_content=corrective, max_tokens=max_tokens)
        try:
            data = json.loads(_extract_json(retry_raw))
            return model_class(**data)
        except (json.JSONDecodeError, ValidationError) as second_err:
            raise ValueError(f"Claude returned invalid JSON after retry: {second_err}") from second_err


async def _parse_list_with_retry(
    raw: str,
    item_class: type[BaseModel],
    client: AsyncAnthropic,
    system: str,
    user_content: str,
    max_tokens: int,
) -> list[Any]:
    """Parse a JSON array response with one retry on failure."""
    try:
        data = json.loads(_extract_json(raw))
        if not isinstance(data, list):
            raise ValueError("Expected JSON array, got object")
        return [item_class(**item) for item in data]
    except (json.JSONDecodeError, ValidationError, ValueError) as first_err:
        logger.warning("claude_json_list_parse_retry", error=str(first_err))
        corrective = (
            f"Your previous response was not a valid JSON array. Error: {first_err}\n"
            f"Previous response: {raw[:500]}\n"
            "Respond ONLY with a valid JSON array. No explanation."
        )
        retry_raw = await _call_claude(client, system=system,
                                        user_content=corrective, max_tokens=max_tokens)
        try:
            data = json.loads(_extract_json(retry_raw))
            return [item_class(**item) for item in data]
        except (json.JSONDecodeError, ValidationError, ValueError) as second_err:
            raise ValueError(f"Claude returned invalid JSON array after retry: {second_err}") from second_err


def _extract_json(text: str) -> str:
    """
    Strip markdown fences and whitespace from Claude responses.
    Claude sometimes wraps JSON in ```json ... ``` despite being told not to.
    """
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        # Remove first line (``` or ```json) and last line (```)
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    return text.strip()


async def _update_analysis(db: AsyncSession, analysis_id: uuid.UUID, fields: dict) -> None:
    """Update fields on an RFPAnalysis row and flush to DB."""
    result = await db.execute(select(RFPAnalysis).where(RFPAnalysis.id == analysis_id))
    analysis = result.scalar_one_or_none()
    if analysis is None:
        raise ValueError(f"RFPAnalysis {analysis_id} not found during pipeline")
    for key, value in fields.items():
        setattr(analysis, key, value)
    await db.flush()
    await db.commit()
