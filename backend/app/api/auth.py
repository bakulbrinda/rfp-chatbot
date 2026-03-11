import hashlib
from datetime import datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.auth.password import hash_password, verify_password
from app.core.auth.tokens import create_access_token, create_refresh_token
from app.db.session import get_db
from app.dependencies import get_current_user
from app.models.db_models import RefreshToken, User
from app.models.schemas import LoginRequest, LoginResponse, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "im_refresh"
ACCESS_COOKIE = "im_access"
COOKIE_MAX_AGE = settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400


@router.post("/login", response_model=LoginResponse)
async def login(body: LoginRequest, response: Response, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    access_token = create_access_token(str(user.id), user.role)
    raw_refresh, refresh_hash = create_refresh_token()

    # Store refresh token hash
    db_token = RefreshToken(
        user_id=user.id,
        token_hash=refresh_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(db_token)
    await db.commit()

    # Set httpOnly refresh cookie (only sent to /auth/refresh)
    response.set_cookie(
        key=REFRESH_COOKIE,
        value=raw_refresh,
        httponly=True,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="strict",
        max_age=COOKIE_MAX_AGE,
        path="/auth/refresh",
    )
    # Set access token cookie for Next.js middleware (readable by edge runtime)
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=access_token,
        httponly=False,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="strict",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return LoginResponse(access_token=access_token, user=UserOut.model_validate(user))


@router.post("/refresh")
async def refresh_token(
    response: Response,
    db: AsyncSession = Depends(get_db),
    im_refresh: str | None = Cookie(default=None),
):
    if not im_refresh:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="No refresh token")

    token_hash = hashlib.sha256(im_refresh.encode()).hexdigest()

    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_hash)
    )
    db_token = result.scalar_one_or_none()

    if not db_token or db_token.revoked:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if db_token.expires_at.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired")

    # Fetch user
    user_result = await db.execute(select(User).where(User.id == db_token.user_id))
    user = user_result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    # Rotate: revoke old token
    db_token.revoked = True
    db_token.revoked_at = datetime.now(timezone.utc)

    # Issue new tokens
    new_access = create_access_token(str(user.id), user.role)
    new_raw, new_hash = create_refresh_token()

    new_token = RefreshToken(
        user_id=user.id,
        token_hash=new_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
    )
    db.add(new_token)
    await db.commit()

    response.set_cookie(
        key=REFRESH_COOKIE,
        value=new_raw,
        httponly=True,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="strict",
        max_age=COOKIE_MAX_AGE,
        path="/auth/refresh",
    )
    response.set_cookie(
        key=ACCESS_COOKIE,
        value=new_access,
        httponly=False,
        secure=(settings.ENVIRONMENT == "production"),
        samesite="strict",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )

    return {"access_token": new_access}


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # Revoke all refresh tokens for this user
    await db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == current_user.id, RefreshToken.revoked.is_(False))
        .values(revoked=True, revoked_at=datetime.now(timezone.utc))
    )
    await db.commit()

    response.delete_cookie(REFRESH_COOKIE, path="/auth/refresh")
    response.delete_cookie(ACCESS_COOKIE, path="/")


@router.get("/me", response_model=UserOut)
async def me(current_user: User = Depends(get_current_user)):
    return UserOut.model_validate(current_user)
