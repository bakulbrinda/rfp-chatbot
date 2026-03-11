from typing import AsyncGenerator

import cohere
from anthropic import AsyncAnthropic
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer
from jose import JWTError
from qdrant_client import AsyncQdrantClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.auth.tokens import decode_access_token
from app.db.session import get_db
from app.models.db_models import User

bearer_scheme = HTTPBearer(auto_error=False)

# ── Singletons ────────────────────────────────────────────────────────────────
_qdrant_client: AsyncQdrantClient | None = None
_cohere_client: cohere.AsyncClient | None = None
_anthropic_client: AsyncAnthropic | None = None


def get_qdrant_client() -> AsyncQdrantClient:
    global _qdrant_client
    if _qdrant_client is None:
        _qdrant_client = AsyncQdrantClient(
            url=settings.QDRANT_URL,
            api_key=settings.QDRANT_API_KEY or None,
        )
    return _qdrant_client


def get_cohere_client() -> cohere.AsyncClient:
    global _cohere_client
    if _cohere_client is None:
        _cohere_client = cohere.AsyncClient(api_key=settings.COHERE_API_KEY)
    return _cohere_client


def get_anthropic_client() -> AsyncAnthropic:
    global _anthropic_client
    if _anthropic_client is None:
        _anthropic_client = AsyncAnthropic(api_key=settings.ANTHROPIC_API_KEY)
    return _anthropic_client


# ── FastAPI dependencies ───────────────────────────────────────────────────────

async def get_current_user(
    credentials=Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    if credentials is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=str(exc))

    from sqlalchemy import select
    result = await db.execute(select(User).where(User.id == payload["sub"]))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


async def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user
