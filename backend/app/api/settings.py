import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth.password import hash_password
from app.core.utils.instruction_validator import validate_instructions
from app.db.session import get_db
from app.dependencies import require_admin
from app.models.db_models import BotConfig, RefreshToken, User

router = APIRouter(prefix="/api/settings", tags=["settings"])


class UserOut(BaseModel):
    id: str
    name: str
    email: str
    role: str
    is_active: bool
    created_at: str

    model_config = {"from_attributes": True}


class CreateUserBody(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "sales"


class UpdateUserBody(BaseModel):
    name: str | None = None
    role: str | None = None
    is_active: bool | None = None


class ResetPasswordBody(BaseModel):
    password: str


def _to_out(u: User) -> UserOut:
    return UserOut(
        id=str(u.id),
        name=u.name,
        email=u.email,
        role=u.role,
        is_active=u.is_active,
        created_at=u.created_at.isoformat(),
    )


@router.get("/users", response_model=list[UserOut])
async def list_users(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.created_at.asc()))
    return [_to_out(u) for u in result.scalars().all()]


@router.post("/users", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def create_user(
    body: CreateUserBody,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")
    if body.role not in ("admin", "sales"):
        raise HTTPException(status_code=400, detail="Role must be 'admin' or 'sales'")

    user = User(
        id=uuid.uuid4(),
        name=body.name,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        is_active=True,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return _to_out(user)


@router.patch("/users/{user_id}", response_model=UserOut)
async def update_user(
    user_id: str,
    body: UpdateUserBody,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.name is not None:
        user.name = body.name
    if body.role is not None:
        if body.role not in ("admin", "sales"):
            raise HTTPException(status_code=400, detail="Role must be 'admin' or 'sales'")
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
        if not body.is_active:
            # Revoke all refresh tokens
            await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.commit()
    await db.refresh(user)
    return _to_out(user)


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_user(
    user_id: str,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.is_active = False
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.commit()


@router.post("/users/{user_id}/reset-password", status_code=status.HTTP_204_NO_CONTENT)
async def reset_password(
    user_id: str,
    body: ResetPasswordBody,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    user = (await db.execute(select(User).where(User.id == uuid.UUID(user_id)))).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(body.password)
    await db.execute(delete(RefreshToken).where(RefreshToken.user_id == user.id))
    await db.commit()


# ── Bot Configuration ─────────────────────────────────────────────────────────

class BotConfigOut(BaseModel):
    bot_name: str
    instructions: str | None


class BotConfigUpdate(BaseModel):
    bot_name: str | None = None
    instructions: str | None = None
    clear_instructions: bool = False  # pass true to explicitly wipe instructions
    force: bool = False  # pass true to bypass conflict check (not recommended)


class InstructionConflict(BaseModel):
    pattern_name: str
    matched_text: str
    reason: str


class InstructionConflictError(BaseModel):
    detail: str
    conflicts: list[InstructionConflict]


@router.get("/bot-config", response_model=BotConfigOut)
async def get_bot_config(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    row = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
    if not row:
        return BotConfigOut(bot_name="Maya", instructions=None)
    return BotConfigOut(bot_name=row.bot_name, instructions=row.instructions)


@router.put("/bot-config", response_model=BotConfigOut)
async def update_bot_config(
    body: BotConfigUpdate,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    # Validate new instructions for adversarial/conflicting content
    if body.instructions and not body.clear_instructions and not body.force:
        conflicts = validate_instructions(body.instructions)
        if conflicts:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={
                    "message": (
                        "The instruction set contains phrases that conflict with system security rules. "
                        "Review the conflicts below and remove the flagged phrases, "
                        "or pass force=true to override (not recommended)."
                    ),
                    "conflicts": [
                        {
                            "pattern_name": c.pattern_name,
                            "matched_text": c.matched_text,
                            "reason": c.reason,
                        }
                        for c in conflicts
                    ],
                },
            )

    row = (await db.execute(select(BotConfig).where(BotConfig.id == 1))).scalar_one_or_none()
    if not row:
        row = BotConfig(id=1, bot_name="Maya", instructions=None)
        db.add(row)
    if body.bot_name is not None:
        row.bot_name = body.bot_name.strip() or "Maya"
    if body.clear_instructions:
        row.instructions = None
    elif body.instructions is not None:
        row.instructions = body.instructions.strip() or None
    await db.commit()
    await db.refresh(row)
    return BotConfigOut(bot_name=row.bot_name, instructions=row.instructions)
