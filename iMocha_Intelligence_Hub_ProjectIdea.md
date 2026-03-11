# iMocha Intelligence Hub — Project Idea & Architecture

> A RAG-powered enterprise chatbot platform for iMocha's sales, pre-sales, and solution teams.

---

## Project Overview

**"iMocha Intelligence Hub"** is a navigating chatbot interface platform — similar in concept to ChatGPT's Custom GPTs — where responses are strictly grounded in iMocha's internal knowledge base. No hallucinations. No out-of-scope answers. Just accurate, cited, knowledge-base-driven responses.

---

## Core Requirements

1. **Grounded Chatbot**: Responds only from the knowledge base. If data is unavailable, returns a clear fallback message.
2. **Knowledge Base CRUD**: Upload, update, delete, and preview `.docx`, `.pdf`, `.txt` files (up to 15+ files, multi-format).
3. **Analysis Engine**: Given client criteria, generates structured In-Scope / Out-of-Scope / Future Scope analysis.
4. **RFP Module**: Responds to RFPs or generates RFP-equivalent proposal responses.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   iMocha Intelligence Hub                │
├──────────────┬──────────────────────┬───────────────────┤
│  Chat Module │  Knowledge Base CRUD │  Analysis Engine  │
│              │                      │                   │
│  - Chatbot   │  - Upload docs       │  - In-scope       │
│  - History   │  - Delete/Update     │  - Out-of-scope   │
│  - Citations │  - File preview      │  - Future scope   │
└──────┬───────┴──────────┬───────────┴──────────┬────────┘
       │                  │                       │
┌──────▼──────────────────▼───────────────────────▼───────┐
│                    RAG Pipeline                          │
│  Document Ingestion → Chunking → Embedding → Vector DB  │
└──────────────────────────────────┬──────────────────────┘
                                   │
                        ┌──────────▼──────────┐
                        │   Claude API (LLM)   │
                        │  + System Prompt     │
                        │  (Hardcoded Rules)   │
                        └─────────────────────┘
```

---

## Module Breakdown

### 1. Chatbot Interface
- Conversational UI with session history
- **Strict grounding**: System prompt enforces "only answer from retrieved context"
- **Fallback message**: If retrieval confidence is below threshold:
  > "This information is not available in iMocha's current knowledge base. Please contact the team for further details."
- **Source citations**: Every answer cites which document/section it came from
- Multi-turn conversation with context window management

### 2. Knowledge Base Management (CRUD)
- Upload: `.docx`, `.pdf`, `.txt` (multi-format support)
- View all files with metadata (upload date, size, last updated)
- Update: re-upload a file and re-index it automatically
- Delete: removes from storage + vector DB
- **Preview panel**: view document contents before/after upload
- Tag/categorize files (e.g., "Product Docs", "Case Studies", "Pricing", "Tech Specs")

### 3. Analysis Engine (Client Criteria Input)
User inputs a client's requirements → system outputs a structured 3-column report:

| In Scope | Out of Scope | Future Scope |
|----------|--------------|--------------|
| What iMocha currently offers matching criteria | What iMocha doesn't support yet | Roadmap items or potential |

- Exportable as PDF or structured text
- Driven entirely by KB content — no hallucination

### 4. RFP Module
Two modes:
- **RFP Responder**: Paste in an RFP document → generates a structured response using KB data
- **RFP Generator**: Input client name, industry, requirements → generates a proposal-style RFP response
- Output sections: Executive Summary, Solution Overview, Compliance Matrix, Pricing (if in KB), Timeline
- Export to `.docx` or `.pdf`

---

## Enhancement Suggestions (within project scope)

### A. Confidence Scoring & Transparency
Show users a confidence indicator on each response (e.g., "High match", "Partial match", "Not found").

### B. Query Logging & Analytics Dashboard
- Track most-asked questions
- Identify knowledge gaps (questions that returned "not found" frequently)
- Helps the team know which docs need to be added/updated

### C. Role-Based Access Control
- **Admin**: Full CRUD + analytics
- **Sales/Pre-sales**: Chat + Analysis + RFP only (read-only KB)

### D. Comparison Mode
User inputs two different client requirement sets → side-by-side fit analysis — useful for multi-client pitches.

### E. Smart KB Suggestions
When a "not found" response triggers, the system suggests:
> "Consider adding documentation on [topic] to improve coverage."

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend Framework | Next.js 15 (App Router) + React 19 + TypeScript 5.4+ |
| UI Components | shadcn/ui (35+ components — Radix UI + Tailwind) |
| Styling | Tailwind CSS 3.4+ with iMocha brand tokens |
| Animations | Framer Motion 11+ |
| State Management | TanStack Query v5 (server state) + Zustand (UI state) |
| Forms | React Hook Form + Zod |
| Backend API | FastAPI (Python, async) |
| LLM | Claude API (claude-sonnet-4-6) + Citations API |
| Embeddings | Cohere embed-english-v3.0 (1024 dims) |
| Reranker | Cohere Rerank 4 Nimble |
| Vector DB | Qdrant (hybrid: dense + sparse BM25) |
| Document Parsing | unstructured.io (PDF/DOCX/TXT) |
| File Storage | AWS S3 or local filesystem |
| Auth | Self-hosted JWT HS256 — Two-token pattern: 15min access token + 7-day httpOnly refresh token with server-side revocation + rotation |
| Deployment | Docker Compose + GitHub Actions CI/CD |
| DB (metadata) | PostgreSQL 16 |

---

## Frontend Design System & UX Principles

### Stack
**Next.js 15 (App Router)** · **shadcn/ui** · **Framer Motion** · **TanStack Query v5** · **Zustand** · **Tailwind CSS**

### Brand Tokens
| Token | Value | Usage |
|---|---|---|
| `im-orange` | `#F05A28` | CTAs, active nav indicator, progress bars, user message bubbles |
| `im-purple` | `#2D1252` | Headings, brand text, admin accent |
| `im-nav` | `#1C0A38` | Sidebar background |
| `im-bg` | `#F8F7FC` | Page background |
| Font | Plus Jakarta Sans | Display + body |
| shadow-orange | `0 4px 24px rgba(240,90,40,0.18)` | Primary CTA hover |
| shadow-card | `0 2px 16px rgba(45,18,82,0.07)` | Card elevation |

### Route Structure
```
/login                    Public — JWT login (split-screen layout)
/chat                     Protected — new chat / redirect to last session
/chat/[sessionId]         Protected — active session with streaming
/knowledge-base           Protected — KB CRUD
/analysis                 Protected — criteria → scope analysis
/rfp                      Protected — RFP responder + generator
/analytics                Admin-only — query analytics dashboard
```

### Key UI Patterns

**Login Page**: Split-screen — left 60% brand gradient panel (iMocha logo + tagline + decorative mesh), right 40% white login card with RHF+Zod form. Framer Motion fade-up on mount.

**Dashboard Shell**: Fixed left sidebar (`#1C0A38`, 260px ↔ 68px collapsible) + sticky top header (64px white, breadcrumb + user menu). All nav items: orange left-border + tinted bg when active.

**Chat**: shadcn ResizablePanelGroup — session list (left, 30%) + chat thread (right, flex-1). User messages: orange bubble right-aligned. Assistant messages: white card left-aligned with citation pills + confidence badge + copy button. StreamingIndicator: 3-dot Framer Motion stagger. EmptyChatState: 3 glassmorphism suggested-prompt cards.

**Knowledge Base**: Full-width with UploadDropzone (drag-over = orange border) + shadcn DataTable with bulk-select. DocumentPreviewSheet slides from right. Optimistic delete (instant row removal with rollback on error).

**Analysis Engine**: Sticky input panel (left, 360px) + animated 3-column scope grid (right). Scope columns stagger in with Framer Motion. Each ScopeCard expandable to show LLM reasoning. ExportMenu dropdown: PDF, CSV, Markdown.

**RFP Module**: shadcn Tabs (Respond | Generate). Output in shadcn Accordion sections. ComplianceMatrix as color-coded table. Inline per-section "Regenerate" button.

**Analytics**: Bento stats row (4 StatCards) + 2×2 chart grid using shadcn Chart (Recharts wrapper). GapTable with "Add to KB" shortcut. Auto-refreshes every 5 min.

### Loading & Animation Rules
- Page-level loads → **skeleton shimmer** (never full-page spinner)
- Button actions → spinner replaces icon inside button, width unchanged
- Chat messages → Framer Motion `y:12→0, opacity:0→1` stagger
- Sidebar collapse → spring physics width transition
- Analysis results → left-to-right column stagger, 0.1s delay each
- All hover states → `hover:-translate-y-0.5 transition-transform duration-200`

---

## RAG Pipeline Flow

```
Upload File
    ↓
Parse (PDF/DOCX/TXT) → Extract raw text
    ↓
Chunk text (e.g., 500 tokens, 50 token overlap)
    ↓
Generate embeddings per chunk
    ↓
Store in Vector DB with doc metadata
    ↓
User Query → Embed query
    ↓
Retrieve top-K similar chunks
    ↓
Build context → Send to Claude with strict system prompt
    ↓
Response with citations
```

---

## System Prompt Design (Hardcoded Instructions)

```
You are iMocha's internal AI assistant. You ONLY answer based on
the provided context from the knowledge base.

Rules:
1. Never invent or infer information not present in the context.
2. If the answer is not in the context, respond with:
   "This information is not currently available in iMocha's
    knowledge base. Please reach out to the relevant team."
3. Always cite the source document and section.
4. For Analysis requests, structure output as: In-Scope /
   Out-of-Scope / Future Scope based strictly on KB content.
5. For RFP responses, use professional proposal language but
   only use KB-verified facts.
```

---

## Phased Delivery Plan

### Phase 1 — MVP (4–6 weeks)
- Chat interface with RAG pipeline
- KB file upload/delete (basic CRUD)
- Strict grounding with fallback messages

### Phase 2 — Analysis + RFP (3–4 weeks)
- Analysis engine (3-column output)
- RFP responder mode
- Export to PDF/DOCX

### Phase 3 — Enterprise Features (3–4 weeks)
- Role-based access control
- Query analytics dashboard
- Confidence scoring UI
- RFP generator mode
- Full deployment pipeline (Docker + cloud)

---

## Key Differentiators vs Generic Custom GPTs

- **Source-grounded with citations** — verifiable, auditable answers
- **Org-level CRUD** — team can maintain KB without engineering help
- **Structured analysis output** — directly usable in client meetings
- **RFP tooling** — saves hours of pre-sales work
- **Analytics** — identifies gaps in documentation coverage

---

*Project for: iMocha | Created: March 2026*
