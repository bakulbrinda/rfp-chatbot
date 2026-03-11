import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone

from anthropic import AsyncAnthropic
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.db_models import KBSuggestion, QueryLog

logger = logging.getLogger(__name__)


async def run_kb_suggestions_job(anthropic_client: AsyncAnthropic) -> None:
    """
    Query unanswered queries from the last 7 days, cluster them by topic using Claude,
    store results in kb_suggestions table.
    """
    async with AsyncSessionLocal() as db:
        try:
            cutoff = datetime.now(timezone.utc) - timedelta(days=7)
            result = await db.execute(
                select(QueryLog.query_text)
                .where(QueryLog.answer_found == False, QueryLog.created_at >= cutoff)  # noqa: E712
            )
            queries = [r[0] for r in result.all()]

            if len(queries) < 2:
                logger.info("KB suggestions job: not enough unanswered queries to cluster")
                return

            # Use Claude to group queries by topic
            prompt = (
                "Group these unanswered knowledge base queries by topic.\n"
                "Return ONLY a JSON array:\n"
                '[{"topic": "...", "query_count": N, "examples": ["query1", "query2"]}]\n\n'
                "Queries:\n" + "\n".join(f"- {q}" for q in queries[:100])
            )

            response = await anthropic_client.messages.create(
                model="claude-haiku-4-5-20251001",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}],
            )

            raw = response.content[0].text.strip() if response.content else "[]"
            if raw.startswith("```"):
                raw = raw.split("```")[1]
                if raw.startswith("json"):
                    raw = raw[4:]
                raw = raw.strip()

            try:
                clusters = json.loads(raw)
            except json.JSONDecodeError:
                logger.error("KB suggestions: failed to parse Claude response")
                return

            # Clear old suggestions and insert new ones
            await db.execute(delete(KBSuggestion))
            for cluster in clusters:
                if isinstance(cluster, dict) and cluster.get("topic"):
                    db.add(KBSuggestion(
                        topic=cluster["topic"],
                        query_count=int(cluster.get("query_count", 1)),
                        examples=cluster.get("examples", []),
                    ))

            await db.commit()
            logger.info(f"KB suggestions job: created {len(clusters)} topic clusters")

        except Exception as e:
            logger.error(f"KB suggestions job failed: {e}")


async def start_kb_suggestions_scheduler(anthropic_client: AsyncAnthropic) -> None:
    """Run KB suggestions job immediately then every 7 days."""
    await asyncio.sleep(60)  # wait 60s after startup
    while True:
        try:
            await run_kb_suggestions_job(anthropic_client)
        except Exception as e:
            logger.error(f"KB suggestions scheduler error: {e}")
        await asyncio.sleep(7 * 24 * 3600)  # repeat every 7 days
