import uuid
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.models.db_models import Base

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=(settings.ENVIRONMENT == "development"),
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db() -> None:
    """Create tables and seed default admin if not present."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Seed admin user
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select
        from app.models.db_models import User
        from app.core.auth.password import hash_password

        result = await session.execute(
            select(User).where(User.email == settings.ADMIN_EMAIL)
        )
        if not result.scalar_one_or_none():
            admin = User(
                id=uuid.uuid4(),
                name=settings.ADMIN_NAME,
                email=settings.ADMIN_EMAIL,
                password_hash=hash_password(settings.ADMIN_PASSWORD),
                role="admin",
                is_active=True,
            )
            session.add(admin)
            await session.commit()
