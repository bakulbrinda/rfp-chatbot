from datetime import datetime
from typing import Literal, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: UUID
    name: str
    email: str
    role: str

    model_config = {"from_attributes": True}


class LoginResponse(BaseModel):
    access_token: str
    user: UserOut


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: str = "sales"


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


# ── Documents ─────────────────────────────────────────────────────────────────

class DocumentOut(BaseModel):
    id: UUID
    original_name: str
    file_type: str
    category: str
    file_size_kb: Optional[int]
    status: str
    chunk_count: int
    uploaded_at: datetime

    model_config = {"from_attributes": True}


class DocumentList(BaseModel):
    items: list[DocumentOut]
    total: int


# ── Chat ──────────────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    session_id: Optional[str] = None
    message: str


class Citation(BaseModel):
    doc_name: str
    section: str
    page_number: Optional[int] = None
    quote: str


class ChatResponse(BaseModel):
    session_id: str
    answer: str
    citations: list[Citation]
    confidence: Literal["high", "medium", "low", "not_found"]


class ChatSessionOut(BaseModel):
    id: UUID
    title: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ChatMessageOut(BaseModel):
    id: UUID
    role: str
    content: str
    citations: list
    confidence: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionWithMessages(BaseModel):
    session: ChatSessionOut
    messages: list[ChatMessageOut]


# ── Health ────────────────────────────────────────────────────────────────────

class HealthResponse(BaseModel):
    status: str
    postgres: bool
    qdrant: bool
    environment: str
