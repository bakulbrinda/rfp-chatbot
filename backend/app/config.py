from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # LLM & AI
    ANTHROPIC_API_KEY: str
    COHERE_API_KEY: str

    # Vector DB
    QDRANT_URL: str = "http://localhost:6333"
    QDRANT_API_KEY: str = ""
    QDRANT_COLLECTION: str = "imocha_kb"

    # Relational DB
    DATABASE_URL: str

    # File Storage
    STORAGE_BACKEND: str = "local"
    AWS_ACCESS_KEY_ID: str = ""
    AWS_SECRET_ACCESS_KEY: str = ""
    AWS_REGION: str = "ap-south-1"
    AWS_S3_BUCKET: str = ""
    LOCAL_UPLOAD_DIR: str = "./uploads"

    # Auth
    JWT_SECRET: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    BCRYPT_ROUNDS: int = 12

    # Default admin seed
    ADMIN_EMAIL: str
    ADMIN_PASSWORD: str
    ADMIN_NAME: str = "Platform Admin"

    # App
    ENVIRONMENT: str = "development"
    CORS_ORIGINS: str = "http://localhost:3000"
    CORS_ALLOW_CREDENTIALS: bool = True
    LOG_LEVEL: str = "INFO"
    MAX_FILE_SIZE_MB: int = 25

    # RAG tuning
    CRAG_RELEVANCE_THRESHOLD: float = 0.40
    RETRIEVAL_TOP_K: int = 20
    RERANK_TOP_N: int = 5

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
