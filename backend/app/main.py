import os
from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from qdrant_client.models import Distance, SparseVectorParams, VectorParams, Modifier
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.core.utils.rate_limiter import limiter
from app.db.session import init_db
from app.dependencies import get_anthropic_client, get_qdrant_client

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    logger.info("Starting iMocha Intelligence Hub", env=settings.ENVIRONMENT)

    # Create upload directory
    os.makedirs(settings.LOCAL_UPLOAD_DIR, exist_ok=True)

    # Init PostgreSQL tables + seed admin
    await init_db()

    # Init Qdrant collection
    qdrant = get_qdrant_client()
    exists = await qdrant.collection_exists(settings.QDRANT_COLLECTION)
    if not exists:
        await qdrant.create_collection(
            collection_name=settings.QDRANT_COLLECTION,
            vectors_config={
                "dense": VectorParams(size=1024, distance=Distance.COSINE)
            },
            sparse_vectors_config={
                "sparse": SparseVectorParams(modifier=Modifier.IDF)
            },
        )
        logger.info("Qdrant collection created", collection=settings.QDRANT_COLLECTION)

    logger.info("Startup complete")

    # Start KB suggestions background scheduler
    import asyncio as _asyncio
    from app.core.kb_suggestions import start_kb_suggestions_scheduler  # noqa: E402
    _asyncio.create_task(start_kb_suggestions_scheduler(get_anthropic_client()))

    yield

    # Shutdown
    logger.info("Shutting down")


app = FastAPI(
    title="iMocha Intelligence Hub API",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url=None,
)

# Rate limiter
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS
origins = [o.strip() for o in settings.CORS_ORIGINS.split(",")]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Security headers middleware
@app.middleware("http")
async def security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Report-only CSP — monitor in logs before enforcing
    response.headers["Content-Security-Policy-Report-Only"] = (
        "default-src 'self'; "
        "script-src 'self'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "connect-src 'self'; "
        "frame-ancestors 'none'"
    )
    return response


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    log = structlog.get_logger()
    response = await call_next(request)
    log.info(
        "request",
        method=request.method,
        path=request.url.path,
        status=response.status_code,
    )
    return response


# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error("Unhandled exception", exc=str(exc), path=request.url.path)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "Internal server error"},
    )


# Health check
@app.get("/health", tags=["health"])
async def health_check():
    from app.db.session import AsyncSessionLocal
    from app.dependencies import get_qdrant_client
    from app.models.schemas import HealthResponse

    postgres_ok = False
    qdrant_ok = False

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(__import__("sqlalchemy").text("SELECT 1"))
            postgres_ok = True
    except Exception:
        pass

    try:
        qdrant = get_qdrant_client()
        await qdrant.get_collections()
        qdrant_ok = True
    except Exception:
        pass

    return HealthResponse(
        status="ok" if (postgres_ok and qdrant_ok) else "degraded",
        postgres=postgres_ok,
        qdrant=qdrant_ok,
        environment=settings.ENVIRONMENT,
    )


# Routers
from app.api import auth, chat, knowledge_base, analysis, rfp, analytics  # noqa: E402
from app.api import settings as settings_api  # noqa: E402

app.include_router(auth.router)
app.include_router(chat.router)
app.include_router(knowledge_base.router)
app.include_router(analysis.router, prefix="/api/analysis", tags=["analysis"])
app.include_router(rfp.router, prefix="/api/rfp", tags=["rfp"])
app.include_router(analytics.router)
app.include_router(settings_api.router)
