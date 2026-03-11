# iMocha Intelligence Hub — Implementation Plan

> End-to-end implementation roadmap for the iMocha RAG-powered enterprise chatbot platform.

---

## Project At a Glance

| Item | Detail |
|---|---|
| Project Name | iMocha Intelligence Hub |
| Client | iMocha |
| Type | Enterprise RAG Chatbot Platform |
| Phases | 3 (MVP → Analysis + RFP → Enterprise) |
| Total Estimated Duration | ~14 weeks |

---

## Databases Used — Clarified

This project uses **two databases** serving distinct purposes:

### 1. PostgreSQL 16 — Relational Metadata Database
**Purpose**: Stores all structured, relational data that needs querying, filtering, and persistence.

| What it stores | Why PostgreSQL |
|---|---|
| Document metadata (filename, type, category, upload date, status) | Structured CRUD operations |
| Chat sessions and full message history | Relational (session → messages) |
| User accounts and role assignments | Auth integration |
| Query logs for analytics | Aggregation queries (COUNT, GROUP BY) |
| Analysis and RFP history | Linked to user + session records |

**Access pattern**: FastAPI → SQLAlchemy (async ORM) → asyncpg driver → PostgreSQL

### 2. Qdrant — Vector Database
**Purpose**: Stores document chunk embeddings for semantic similarity search (the retrieval part of RAG).

| What it stores | Why Qdrant |
|---|---|
| Dense embedding vectors (3072-dim from OpenAI) | Semantic similarity search |
| Sparse BM25 vectors (keyword matching) | Hybrid retrieval for enterprise terminology |
| Chunk metadata payload (doc_id, section, page, parent text) | Filtered retrieval + citations |

**Access pattern**: FastAPI → qdrant-client (async) → Qdrant (Docker locally / Qdrant Cloud in prod)

> These two databases are complementary, not interchangeable.
> PostgreSQL handles "what files exist and who uploaded them."
> Qdrant handles "which document chunks are semantically relevant to this query."

---

## Full Tech Stack

### Backend

| Tool | Version | Purpose |
|---|---|---|
| Python | 3.11+ | Language |
| FastAPI | 0.115+ | Async REST API framework |
| Uvicorn | 0.30+ | ASGI server |
| SQLAlchemy | 2.0+ | Async ORM for PostgreSQL |
| asyncpg | 0.29+ | Async PostgreSQL driver |
| Alembic | 1.13+ | Database migrations |
| PostgreSQL | 16 | Relational metadata database |
| Qdrant Client | 1.9+ | Vector database client (async) |
| Qdrant | 1.9+ | Vector database (Docker / Cloud) |
| OpenAI Python SDK | 1.30+ | text-embedding-3-large embeddings |
| Anthropic Python SDK | 0.28+ | Claude Sonnet 4.6 + Citations API |
| Cohere Python SDK | 5.5+ | Rerank 4 Nimble |
| unstructured[all-docs] | 0.14+ | Structure-aware PDF/DOCX/TXT parsing |
| python-docx | 1.1+ | DOCX file reading + export |
| reportlab | 4.2+ | PDF export |
| boto3 | 1.34+ | AWS S3 file storage |
| python-jose | 3.3+ | JWT signing + validation (HS256, access + refresh tokens) |
| passlib[bcrypt] | 1.7+ | Password hashing (bcrypt, configurable salt rounds) |
| pydantic | 2.7+ | Request/response validation |
| httpx | 0.27+ | Async HTTP client |
| pytest + pytest-asyncio | latest | Testing |
| ruff | latest | Linting + formatting |

### Frontend

| Tool | Version | Purpose |
|---|---|---|
| Next.js | 15+ | Full-stack React framework (App Router) |
| React | 19+ | UI framework (via Next.js) |
| TypeScript | 5.4+ | Type safety (`"strict": true`) |
| Tailwind CSS | 3.4+ | Utility-first styling |
| shadcn/ui | latest | Premium component library (Radix UI + Tailwind) |
| TanStack Query (React Query) | 5+ | Server state management, caching, loading states |
| Zustand | 4.5+ | Lightweight global UI state (auth, chat, ui slices) |
| Axios | 1.7+ | HTTP client with JWT interceptor |
| React Hook Form | 7.51+ | Form handling |
| Zod | 3.23+ | Schema validation (synced with backend Pydantic) |
| Framer Motion | 11+ | Animations (page transitions, message entrance, sidebar) |
| next-themes | latest | Light/dark mode toggle (defaulting to light) |
| jose | 5+ | Edge-compatible JWT decode (used in middleware.ts) |
| Recharts | 2.12+ | Analytics charts (via shadcn Chart wrapper) |
| react-dropzone | 14.2+ | Drag-and-drop file upload |
| react-markdown | 9+ | Render LLM markdown responses |
| remark-gfm | latest | GitHub Flavored Markdown support |
| rehype-highlight | latest | Syntax highlighting in code blocks |
| date-fns | 3+ | Date formatting utilities |
| lucide-react | latest | Icon library (bundled with shadcn) |
| ESLint + Prettier | latest | Linting + formatting |

### Infrastructure

| Tool | Purpose |
|---|---|
| Docker | Containerization of all services |
| Docker Compose | Local multi-service orchestration |
| GitHub Actions | CI/CD pipeline |
| AWS S3 | Production file storage |
| Nginx | Reverse proxy + TLS termination |
| Railway / AWS ECS | Production deployment |

---

## Repository Structure

```
imocha-intelligence-hub/
│
├── backend/
│   ├── app/
│   │   ├── main.py                      # FastAPI app init, middleware, router registration
│   │   ├── config.py                    # Pydantic Settings — reads all env vars
│   │   ├── dependencies.py              # Shared FastAPI deps (db session, auth, qdrant client)
│   │   │
│   │   ├── api/                         # Route handlers only — no business logic here
│   │   │   ├── __init__.py
│   │   │   ├── chat.py                  # POST /chat, GET/DELETE /chat/sessions
│   │   │   ├── knowledge_base.py        # CRUD /kb/files
│   │   │   ├── analysis.py              # POST /analysis, GET history, POST export
│   │   │   ├── rfp.py                   # POST /rfp/respond + /rfp/generate, export
│   │   │   └── analytics.py             # GET /analytics/* (admin only)
│   │   │
│   │   ├── core/
│   │   │   ├── rag/
│   │   │   │   ├── pipeline.py          # Orchestrates full CRAG query flow
│   │   │   │   ├── retriever.py         # Qdrant hybrid search (dense + sparse), top-20
│   │   │   │   ├── reranker.py          # Cohere Rerank 4 Nimble, top-20 → top-5
│   │   │   │   ├── evaluator.py         # CRAG gate: relevance score threshold check
│   │   │   │   └── embedder.py          # OpenAI text-embedding-3-large, async batch
│   │   │   │
│   │   │   ├── ingestion/
│   │   │   │   ├── parser.py            # unstructured.io: extract elements from PDF/DOCX/TXT
│   │   │   │   ├── chunker.py           # Parent-Document Retriever: child 250t / parent 700t
│   │   │   │   └── indexer.py           # Qdrant upsert + delete-by-doc-id
│   │   │   │
│   │   │   └── llm/
│   │   │       ├── claude_client.py     # Anthropic SDK: Citations API, streaming-ready
│   │   │       ├── prompts.py           # All hardcoded system prompts (chat, analysis, RFP)
│   │   │       └── confidence.py        # Confidence score derived from rerank scores
│   │   │
│   │   ├── models/
│   │   │   ├── db_models.py             # SQLAlchemy ORM table definitions
│   │   │   └── schemas.py               # Pydantic v2 request/response schemas
│   │   │
│   │   ├── services/
│   │   │   ├── file_service.py          # S3/local upload, delete, presigned URL
│   │   │   ├── analysis_service.py      # Analysis engine: RAG call + structured JSON output
│   │   │   └── rfp_service.py           # RFP responder + generator logic
│   │   │
│   │   └── db/
│   │       ├── session.py               # Async SQLAlchemy engine + session factory
│   │       └── migrations/              # Alembic auto-generated migration files
│   │           └── versions/
│   │
│   ├── tests/
│   │   ├── conftest.py                  # Shared fixtures (test DB, mock clients)
│   │   ├── test_rag_pipeline.py
│   │   ├── test_ingestion.py
│   │   ├── test_api_chat.py
│   │   ├── test_api_kb.py
│   │   └── test_api_analysis.py
│   │
│   ├── Dockerfile
│   ├── requirements.txt
│   └── pyproject.toml                   # ruff config + project metadata
│
├── frontend/
│   ├── app/                                  # Next.js 15 App Router root
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx                  # JWT login page (split-screen layout)
│   │   │
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx                    # Dashboard shell: AppSidebar + TopHeader
│   │   │   ├── chat/
│   │   │   │   ├── page.tsx                  # New chat (redirects or shows empty state)
│   │   │   │   └── [sessionId]/
│   │   │   │       └── page.tsx              # Active session view
│   │   │   ├── knowledge-base/
│   │   │   │   └── page.tsx
│   │   │   ├── analysis/
│   │   │   │   └── page.tsx
│   │   │   ├── rfp/
│   │   │   │   └── page.tsx
│   │   │   └── analytics/
│   │   │       └── page.tsx                  # Admin-only dashboard
│   │   │
│   │   ├── globals.css                       # Tailwind base + CSS variables + brand tokens
│   │   ├── layout.tsx                        # Root layout: ThemeProvider, QueryClientProvider, Toaster
│   │   └── not-found.tsx                     # Custom 404 page
│   │
│   ├── components/
│   │   ├── ui/                               # shadcn/ui generated (DO NOT edit manually)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── card.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── drawer.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── toggle.tsx
│   │   │   ├── toggle-group.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── tooltip.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── command.tsx
│   │   │   ├── select.tsx
│   │   │   ├── form.tsx
│   │   │   ├── label.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── breadcrumb.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── resizable.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── accordion.tsx
│   │   │   ├── sidebar.tsx
│   │   │   ├── chart.tsx                     # Recharts wrapper
│   │   │   ├── sonner.tsx                    # Toast notifications
│   │   │   └── alert.tsx
│   │   │
│   │   ├── shell/                            # App layout chrome
│   │   │   ├── AppSidebar.tsx                # shadcn Sidebar: nav links, role-aware items, user avatar
│   │   │   ├── SidebarNavItem.tsx            # Single nav link with active state + icon
│   │   │   ├── SidebarChatHistory.tsx        # Collapsible list of recent chat sessions in sidebar
│   │   │   ├── TopHeader.tsx                 # Breadcrumb + user menu (sticky, 64px)
│   │   │   ├── UserMenu.tsx                  # Avatar dropdown: profile, settings, logout
│   │   │   └── Providers.tsx                 # QueryClientProvider + ThemeProvider + Toaster
│   │   │
│   │   ├── auth/
│   │   │   ├── LoginForm.tsx                 # RHF + Zod form: email, password, submit
│   │   │   └── AuthGuard.tsx                 # Client-side secondary role guard
│   │   │
│   │   ├── chat/
│   │   │   ├── ChatThread.tsx                # Scrollable message list with auto-scroll
│   │   │   ├── ChatMessage.tsx               # User (right, orange) / assistant (left, white card)
│   │   │   ├── ChatInput.tsx                 # Auto-resize textarea + send (Cmd+Enter)
│   │   │   ├── CitationBadge.tsx             # Inline pill: doc name + page → popover with excerpt
│   │   │   ├── CitationSheet.tsx             # shadcn Sheet (slide-in) with full citation detail
│   │   │   ├── ConfidenceBadge.tsx           # Green/amber/red badge with text label
│   │   │   ├── FallbackCard.tsx              # Amber bordered card for "not in KB" responses
│   │   │   ├── StreamingIndicator.tsx        # 3-dot Framer Motion stagger animation
│   │   │   ├── SessionList.tsx               # Session sidebar with search + new chat button
│   │   │   └── EmptyChatState.tsx            # Welcome screen with 3 suggested prompt cards
│   │   │
│   │   ├── knowledge-base/
│   │   │   ├── UploadDropzone.tsx            # react-dropzone with drag-over state (orange border)
│   │   │   ├── UploadProgressCard.tsx        # Per-file: filename + progress bar (im-orange)
│   │   │   ├── DocumentTable.tsx             # shadcn Table: name, type, size, status, date, actions
│   │   │   ├── DocumentStatusBadge.tsx       # processing (amber+spinner) / indexed (green) / failed (red)
│   │   │   ├── DocumentPreviewSheet.tsx      # shadcn Sheet: extracted text in ScrollArea
│   │   │   ├── DeleteDocumentDialog.tsx      # shadcn AlertDialog confirmation
│   │   │   └── EmptyKBState.tsx              # Illustrated empty state + upload CTA
│   │   │
│   │   ├── analysis/
│   │   │   ├── CriteriaForm.tsx              # RHF+Zod: criteria textarea + optional client name
│   │   │   ├── ScopeColumns.tsx              # 3-column grid (In / Out / Future)
│   │   │   ├── ScopeCard.tsx                 # Single scope item: text + citations + expand button
│   │   │   ├── AnalysisHistory.tsx           # Sidebar list of past analyses
│   │   │   ├── ExportMenu.tsx                # DropdownMenu: PDF / DOCX / Copy Markdown
│   │   │   └── EmptyAnalysisState.tsx        # Pre-filled example criteria to guide users
│   │   │
│   │   ├── rfp/
│   │   │   ├── RFPModeTabs.tsx               # shadcn Tabs: "Respond to RFP" | "Generate Proposal"
│   │   │   ├── RFPResponderInput.tsx         # Textarea + optional file upload
│   │   │   ├── RFPGeneratorForm.tsx          # Structured form: client, industry, dynamic requirements
│   │   │   ├── RFPOutputPanel.tsx            # Collapsible sections via shadcn Accordion
│   │   │   ├── ComplianceMatrix.tsx          # Table: requirement, capability, status (color-coded)
│   │   │   ├── ExportRFPButton.tsx           # Download DOCX / Copy Markdown
│   │   │   └── RFPHistory.tsx                # Past RFP list in sidebar
│   │   │
│   │   ├── analytics/
│   │   │   ├── StatCard.tsx                  # shadcn Card: icon + metric + trend badge
│   │   │   ├── QueryVolumeChart.tsx          # shadcn Chart LineChart — 30-day volume
│   │   │   ├── ConfidenceDistChart.tsx       # shadcn Chart BarChart — confidence distribution
│   │   │   ├── TopDocumentsTable.tsx         # Most-queried documents with hit count
│   │   │   ├── GapTable.tsx                  # Unanswered queries + "Add to KB" shortcut
│   │   │   ├── ExportCSVButton.tsx           # Downloads full query log as CSV
│   │   │   └── AnalyticsSkeleton.tsx         # Full-page skeleton during initial fetch
│   │   │
│   │   └── shared/
│   │       ├── PageHeader.tsx                # Consistent: title + description + right-slot (actions)
│   │       ├── EmptyState.tsx                # Reusable: SVG icon + heading + subtext + CTA
│   │       ├── MarkdownRenderer.tsx          # react-markdown + remark-gfm + rehype-highlight
│   │       ├── CopyButton.tsx                # Icon button that copies text + shows checkmark
│   │       ├── ErrorBoundary.tsx             # Catches render errors, shows retry card
│   │       └── LoadingPage.tsx               # Full-page shimmer skeleton
│   │
│   ├── hooks/
│   │   ├── useAuth.ts                        # Returns { user, token, isAdmin, login, logout }
│   │   ├── useChatStream.ts                  # SSE streaming: accumulates tokens, invalidates TQ cache
│   │   ├── useChatSessions.ts                # TanStack Query: session list + create/delete mutations
│   │   ├── useDocuments.ts                   # TanStack Query: document list + upload/delete/reindex
│   │   ├── useUpload.ts                      # react-dropzone + axios onUploadProgress tracking
│   │   ├── useAnalysis.ts                    # Mutation: POST criteria → AnalysisResult
│   │   ├── useRFP.ts                         # Mutation: POST RFP text or form → RFPOutput
│   │   ├── useAnalytics.ts                   # TanStack Query: analytics data, refetch every 5min
│   │   ├── useLocalStorage.ts                # Type-safe localStorage with SSR guard
│   │   └── useToast.ts                       # Sonner toast wrappers: success, error, loading, promise
│   │
│   ├── store/
│   │   ├── authStore.ts                      # Zustand (NOT persisted): accessToken in memory, user decoded from token
│   │   ├── chatStore.ts                      # Zustand: activeSessionId, pendingMessage, isStreaming
│   │   ├── uiStore.ts                        # Zustand: sidebarCollapsed, citationDrawer, rfpMode
│   │   └── index.ts                          # Re-exports all stores
│   │
│   ├── lib/
│   │   ├── api/
│   │   │   ├── client.ts                     # Axios instance: baseURL + JWT interceptor + 401 handler
│   │   │   ├── auth.ts                       # authApi.login(), authApi.me()
│   │   │   ├── chat.ts                       # chatApi.getSessions(), sendMessage(), etc.
│   │   │   ├── documents.ts                  # documentsApi.list(), upload(), delete(), reindex()
│   │   │   ├── analysis.ts                   # analysisApi.run(), history()
│   │   │   ├── rfp.ts                        # rfpApi.respond(), generate(), history()
│   │   │   └── analytics.ts                  # analyticsApi.summary(), volume(), gaps()
│   │   │
│   │   ├── auth/
│   │   │   └── jwt.ts                        # decodeToken(), isTokenExpired(), getTokenRole() via jose (edge-safe, no verify)
│   │   │
│   │   ├── utils.ts                          # cn(), formatDate(), formatRelativeTime(), formatFileSize()
│   │   ├── constants.ts                      # QUERY_KEYS, API_ROUTES, CONFIDENCE_THRESHOLDS
│   │   └── validators/
│   │       ├── loginSchema.ts                # Zod: email + password
│   │       ├── analysisSchema.ts             # Zod: criteria text + document IDs
│   │       └── rfpSchema.ts                  # Zod: mode-conditional (responder vs generator)
│   │
│   ├── types/
│   │   ├── auth.ts                           # User, JWTPayload, LoginRequest/Response
│   │   ├── chat.ts                           # ChatSession, ChatMessage, Citation
│   │   ├── document.ts                       # Document, DocumentStatus, UploadProgress
│   │   ├── analysis.ts                       # ScopeItem, AnalysisResult
│   │   ├── rfp.ts                            # RFPSection, ComplianceItem, RFPOutput
│   │   └── analytics.ts                      # AnalyticsSummary, QueryDataPoint, TopDocument
│   │
│   ├── middleware.ts                         # Next.js edge middleware: JWT check → redirect /login
│   ├── components.json                       # shadcn/ui config (baseColor, cssVariables, etc.)
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
│
├── docker-compose.yml                   # Dev: backend + frontend + qdrant + postgres
├── docker-compose.prod.yml              # Production compose with Nginx
├── nginx.conf                           # Reverse proxy config
├── .env.example                         # Template for all required env vars
└── .github/
    └── workflows/
        └── deploy.yml                   # GitHub Actions CI/CD pipeline
```

---

## Global Rules & Conventions

### Backend Rules
1. **All API handlers are thin** — route files only validate input and delegate to services or core modules. No business logic in `api/` files.
2. **All database calls are async** — use `async with session` pattern everywhere. Never use sync SQLAlchemy in a FastAPI context.
3. **All external API calls are async** — OpenAI, Anthropic, Cohere clients must use async methods.
4. **Pydantic v2 for all I/O** — every request body and response must be a Pydantic BaseModel. No raw dicts returned from endpoints.
5. **Never call the LLM if the CRAG gate fails** — the evaluator runs before the Claude client is called. This is non-negotiable for cost and accuracy control.
6. **System prompts are immutable at runtime** — all prompts live in `prompts.py` and are loaded at startup. No user input can modify the system prompt.
7. **Qdrant and PostgreSQL are always in sync** — any document delete must remove from both databases atomically (wrap in try/except rollback if Qdrant fails after Postgres commit).
8. **No secrets in code** — all credentials loaded via `config.py` from environment variables using Pydantic Settings.
9. **Rate limiting on all endpoints** — use `slowapi` middleware. Default: 60 req/min per user on chat, 20 req/min on analysis/RFP.
10. **Health check at `GET /health`** — returns status of Postgres + Qdrant connections.

### Frontend Rules
1. **Next.js App Router** — use the `(auth)` and `(dashboard)` route groups. Page files are `page.tsx`; layout files are `layout.tsx`. Do not use `pages/` directory.
2. **`'use client'` only when necessary** — prefer Server Components for layout shells; use `'use client'` only for components with hooks, browser APIs, or event handlers.
3. **All server state via TanStack Query** — no manual `useEffect` for API calls. `useQuery` for reads, `useMutation` for writes. Mutations invalidate via typed `QUERY_KEYS` constants.
4. **All global UI state via Zustand** — three slices: `authStore` (token + user), `chatStore` (active session + streaming), `uiStore` (sidebar, modals). Server data never lives in Zustand.
5. **All API calls via `lib/api/client.ts`** — Axios instance that auto-attaches JWT from `authStore`. Never use raw `fetch` or `axios` directly in components.
6. **TypeScript strict mode** — `"strict": true` in `tsconfig.json`. No `any` types. No `as unknown as X` casts unless truly unavoidable.
7. **Zod + React Hook Form on all forms** — every form uses `useForm` with `zodResolver`. Validation errors shown inline via shadcn `<FormMessage>`.
8. **shadcn/ui components only** — never write raw Radix UI primitives; always go through the shadcn generated files in `components/ui/`. Custom variants via `cn()`.
9. **Route protection at two levels**: (a) `middleware.ts` — edge-level JWT check and role enforcement; (b) `AuthGuard.tsx` — client-side secondary guard. Never rely on just one layer.
10. **LLM responses rendered with `<MarkdownRenderer>`** — wraps react-markdown + remark-gfm + rehype-highlight. Never use `dangerouslySetInnerHTML` for API content.
11. **Optimistic UI on KB mutations** — TanStack Query `onMutate` + `onError` rollback for file delete, reindex. User sees instant feedback.
12. **Loading states are always skeletons** — use `<Skeleton>` (shadcn) for page-level data loads. Spinners only for button-level inline actions.
13. **No hardcoded API URLs** — all base URLs from `process.env.NEXT_PUBLIC_API_URL`. Route strings from `lib/constants.ts → API_ROUTES`.
14. **All icons from lucide-react** — no other icon library. Icon-only buttons require `aria-label`.
15. **Animations via Framer Motion** — chat message entrance, sidebar collapse, analysis result stagger, citation sheet slide-in. Simple hover/active transitions via Tailwind `transition-*` classes only.
16. **Accessibility** — all dialogs/sheets: `aria-labelledby` + `aria-describedby`. All interactive elements have focus-visible rings (`ring-2 ring-im-orange ring-offset-2`). Color is never the sole differentiator (badges always have text labels too).
17. **Named exports for components** — all component files use named exports. Only `page.tsx` and `layout.tsx` files use default exports (required by Next.js).

---

## Phase 1 — MVP: Core Chatbot + KB CRUD
**Duration: 4–6 weeks**
**Goal: A working, grounded chatbot with knowledge base management, deployable via Docker.**

---

### Step 1.1 — Project Setup & Infrastructure (Week 1)

**Tasks**
- [ ] Initialize repo: `backend/` (Python 3.11, FastAPI) + `frontend/` (Next.js 15)
- [ ] Backend: create `pyproject.toml` with ruff config, `requirements.txt` with all pinned versions
- [ ] Backend: set up `config.py` using Pydantic `BaseSettings` — reads all env vars at startup, fails fast if missing
- [ ] Backend: configure FastAPI middleware: CORS, request logging, global error handler
- [ ] Backend: implement auth module (`api/auth.py` + `core/auth/`) — see Auth System section below
- [ ] Backend: seed default admin user on first boot (reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` from env)
- [ ] Backend: set up Alembic for migrations (`alembic init`)
- [ ] Docker Compose: `backend` (FastAPI on 8000), `qdrant` (6333/6334), `postgres` (5432), `frontend` (3000)
- [ ] Frontend: `npx create-next-app@latest frontend --typescript --tailwind --app --src-dir=false --import-alias="@/*"`
- [ ] Frontend: install shadcn CLI → `npx shadcn@latest init` → configure `components.json` (baseColor: neutral, cssVariables: true)
- [ ] Frontend: install all 35 shadcn components: `npx shadcn@latest add button input textarea card badge dialog alert-dialog sheet drawer table tabs toggle toggle-group skeleton progress tooltip popover dropdown-menu command select form label avatar separator breadcrumb scroll-area resizable collapsible accordion sidebar chart sonner alert`
- [ ] Frontend: install additional packages: `framer-motion next-themes jose date-fns react-dropzone react-markdown remark-gfm rehype-highlight axios @tanstack/react-query zustand react-hook-form zod lucide-react`
- [ ] Frontend: configure `tailwind.config.ts` — add iMocha brand tokens (im-orange #F05A28, im-purple #2D1252, im-nav #1C0A38, im-bg #F8F7FC), Plus Jakarta Sans font, custom shadows and animations
- [ ] Frontend: configure `globals.css` — CSS variables for shadcn theming + brand overrides
- [ ] Frontend: implement `middleware.ts` — edge JWT check using `jose`, redirect unauthenticated to `/login`, redirect non-admin from `/analytics` to `/chat`
- [ ] Frontend: set up Zustand stores: `authStore` (persist), `chatStore`, `uiStore`
- [ ] Frontend: set up `lib/api/client.ts` — Axios instance with: (a) request interceptor: attaches access token from `authStore` as `Authorization: Bearer`; (b) response interceptor: on 401 → silently call `POST /auth/refresh` → retry original request → if refresh fails: clear auth + redirect `/login`; implement request queue to avoid parallel refresh calls
- [ ] Create `.env.example` with all required variable names (no values)

**PostgreSQL Schema — Initial Migration**
```sql
-- users: org-managed accounts (no self-registration)
CREATE TABLE users (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         TEXT NOT NULL,
    email        TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,            -- bcrypt hash, never plain text
    role         TEXT NOT NULL DEFAULT 'sales' CHECK (role IN ('admin', 'sales')),
    is_active    BOOLEAN DEFAULT true,
    created_at   TIMESTAMPTZ DEFAULT now(),
    updated_at   TIMESTAMPTZ DEFAULT now()
);

-- refresh_tokens: server-side storage for revocation + rotation
CREATE TABLE refresh_tokens (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash   TEXT NOT NULL UNIQUE,      -- SHA-256 hash of the raw refresh token
    expires_at   TIMESTAMPTZ NOT NULL,
    revoked      BOOLEAN DEFAULT false,
    revoked_at   TIMESTAMPTZ,
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- documents: KB file metadata
CREATE TABLE documents (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    filename      TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_type     TEXT NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt')),
    category      TEXT DEFAULT 'General',
    file_size_kb  INTEGER,
    storage_url   TEXT NOT NULL,
    status        TEXT DEFAULT 'processing' CHECK (status IN ('processing', 'indexed', 'error')),
    chunk_count   INTEGER DEFAULT 0,
    uploaded_by   TEXT NOT NULL,
    uploaded_at   TIMESTAMPTZ DEFAULT now(),
    updated_at    TIMESTAMPTZ DEFAULT now()
);

-- chat_sessions: one session per conversation thread
CREATE TABLE chat_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     TEXT NOT NULL,
    title       TEXT DEFAULT 'New Chat',
    created_at  TIMESTAMPTZ DEFAULT now(),
    updated_at  TIMESTAMPTZ DEFAULT now()
);

-- chat_messages: every turn in a session
CREATE TABLE chat_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    role        TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
    content     TEXT NOT NULL,
    citations   JSONB DEFAULT '[]',        -- [{doc_name, section, page, quote}]
    confidence  TEXT CHECK (confidence IN ('high', 'medium', 'low', 'not_found')),
    created_at  TIMESTAMPTZ DEFAULT now()
);

-- query_logs: every query for analytics (Phase 3)
CREATE TABLE query_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id    UUID REFERENCES chat_sessions(id),
    user_id       TEXT NOT NULL,
    query_text    TEXT NOT NULL,
    answer_found  BOOLEAN NOT NULL,
    confidence    TEXT,
    module        TEXT NOT NULL CHECK (module IN ('chat', 'analysis', 'rfp')),
    created_at    TIMESTAMPTZ DEFAULT now()
);

-- Indexes for common queries
CREATE INDEX idx_chat_messages_session ON chat_messages(session_id);
CREATE INDEX idx_query_logs_user ON query_logs(user_id);
CREATE INDEX idx_query_logs_answer_found ON query_logs(answer_found);
CREATE INDEX idx_documents_status ON documents(status);
```

---

### Auth System — Full Specification

**Token Strategy: Two-Token Pattern**

| Token | Lifespan | Storage (Client) | Storage (Server) | Purpose |
|---|---|---|---|---|
| Access Token | 15 minutes | Memory (Zustand) + mirrored to `im_access` cookie | None (stateless) | Attached to every API request as `Authorization: Bearer` |
| Refresh Token | 7 days | `httpOnly; Secure; SameSite=Strict` cookie | `refresh_tokens` table (SHA-256 hash) | Used only to issue a new access token |

**Why this design:**
- Access token is short-lived → compromise window is tiny (15 min max)
- Refresh token is httpOnly → JavaScript cannot read it (XSS-proof)
- Refresh token stored server-side → can be revoked instantly on logout or password change
- Refresh token rotation → each use issues a new refresh token, invalidating the old one (replay-attack protection)

**Backend Auth Module (`app/core/auth/`)**

```python
# core/auth/password.py
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto", bcrypt__rounds=12)

def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

```python
# core/auth/tokens.py
import hashlib, secrets
from datetime import datetime, timedelta, timezone
from jose import jwt, JWTError
from app.config import settings

ACCESS_TOKEN_EXPIRE_MINUTES = settings.ACCESS_TOKEN_EXPIRE_MINUTES  # 15
REFRESH_TOKEN_EXPIRE_DAYS   = settings.REFRESH_TOKEN_EXPIRE_DAYS    # 7
ALGORITHM = "HS256"

def create_access_token(user_id: str, role: str) -> str:
    payload = {
        "sub":  user_id,
        "role": role,
        "type": "access",
        "iat":  datetime.now(timezone.utc),
        "exp":  datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    }
    return jwt.encode(payload, settings.JWT_SECRET, algorithm=ALGORITHM)

def create_refresh_token() -> tuple[str, str]:
    """Returns (raw_token, sha256_hash). Store hash in DB; send raw to client."""
    raw = secrets.token_urlsafe(64)
    hashed = hashlib.sha256(raw.encode()).hexdigest()
    return raw, hashed

def decode_access_token(token: str) -> dict:
    """Raises JWTError if invalid or expired."""
    payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
    if payload.get("type") != "access":
        raise JWTError("Not an access token")
    return payload
```

```python
# api/auth.py — endpoints
POST /auth/login
  Body:    { email, password }
  Logic:   1. Fetch user by email from DB
           2. verify_password(body.password, user.password_hash)
           3. If fail → 401
           4. create_access_token(user.id, user.role)
           5. create_refresh_token() → store hash in refresh_tokens table
           6. Return access_token in response body
           7. Set refresh token as httpOnly cookie:
              Set-Cookie: im_refresh=<raw>; HttpOnly; Secure; SameSite=Strict; Path=/auth/refresh; Max-Age=604800

POST /auth/refresh
  Cookie:  im_refresh=<raw_token>
  Logic:   1. Hash the raw cookie token
           2. Fetch refresh_tokens row by hash
           3. If not found / revoked / expired → 401 (clear cookie)
           4. Mark old token as revoked (rotation)
           5. create_access_token(user.id, user.role)
           6. create_refresh_token() → store new hash
           7. Return new access_token + set new refresh cookie
  Note:    Path=/auth/refresh means browser ONLY sends this cookie to this endpoint

POST /auth/logout
  Header:  Authorization: Bearer <access_token>
  Logic:   1. Verify access token to get user_id
           2. Hash refresh token from cookie
           3. Mark all of user's refresh tokens as revoked (logout from all devices)
           4. Clear im_refresh cookie
           5. Return 204

GET /auth/me
  Header:  Authorization: Bearer <access_token>
  Returns: { id, name, email, role }

POST /settings/users          (Admin only) — create new org user
PATCH /settings/users/{id}    (Admin only) — update name/role/active status
DELETE /settings/users/{id}   (Admin only) — deactivate (set is_active=false, revoke all tokens)
POST /settings/users/{id}/reset-password  (Admin only) — set new password, revoke all refresh tokens
```

```python
# dependencies.py — FastAPI dependency for protected routes
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer

bearer_scheme = HTTPBearer()

async def get_current_user(token = Depends(bearer_scheme), db = Depends(get_db)):
    try:
        payload = decode_access_token(token.credentials)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired access token")
    user = await db.get(User, payload["sub"])
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="User not found or deactivated")
    return user

async def require_admin(current_user = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user
```

**Frontend Auth Flow**

```typescript
// store/authStore.ts
interface AuthState {
  accessToken: string | null          // in-memory + mirrored to im_access cookie for middleware
  user: { id: string; name: string; email: string; role: 'admin' | 'sales' } | null
  setAuth: (token: string, user: User) => void
  clear: () => void
  isAdmin: () => boolean
}
// NOTE: accessToken stored in Zustand memory only (NOT persisted to localStorage)
// On page refresh: call GET /auth/me using the refresh token cookie → re-issue access token
// This means authStore is NOT persisted — rehydration happens via /auth/refresh on mount
```

```typescript
// lib/api/client.ts — Axios with silent refresh
let isRefreshing = false
let failedQueue: Array<{ resolve: Function; reject: Function }> = []

axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        // Queue other 401s while a refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        }).then((token) => {
          originalRequest.headers['Authorization'] = `Bearer ${token}`
          return axiosInstance(originalRequest)
        })
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        // Browser automatically sends im_refresh httpOnly cookie
        const { data } = await axios.post('/auth/refresh', {}, { withCredentials: true })
        const newAccessToken = data.access_token

        authStore.getState().setAuth(newAccessToken, authStore.getState().user!)
        // Mirror to cookie for middleware
        document.cookie = `im_access=${newAccessToken}; path=/; max-age=900; SameSite=Strict`

        failedQueue.forEach(({ resolve }) => resolve(newAccessToken))
        failedQueue = []

        originalRequest.headers['Authorization'] = `Bearer ${newAccessToken}`
        return axiosInstance(originalRequest)
      } catch (refreshError) {
        failedQueue.forEach(({ reject }) => reject(refreshError))
        failedQueue = []
        authStore.getState().clear()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
```

```typescript
// app/(auth)/login/page.tsx — on successful login
const onSubmit = async (values: LoginFormValues) => {
  const { data } = await authApi.login(values)          // POST /auth/login (withCredentials: true)
  // data = { access_token, user: { id, name, email, role } }
  // Refresh token is set as httpOnly cookie by server — frontend never sees it
  authStore.setAuth(data.access_token, data.user)
  // Mirror access token to cookie for Next.js middleware
  document.cookie = `im_access=${data.access_token}; path=/; max-age=900; SameSite=Strict`
  router.push('/chat')
}
```

```typescript
// middleware.ts — reads im_access cookie (access token only)
// If im_access is missing or expired → redirect to /login
// Client will then attempt /auth/refresh on mount (the httpOnly im_refresh cookie is sent automatically)
// If refresh succeeds → user gets new access token and re-navigates
// If refresh fails → user stays on /login

export function middleware(req: NextRequest) {
  const accessToken = req.cookies.get('im_access')?.value
  const isProtected = req.nextUrl.pathname.match(/^\/(chat|knowledge-base|analysis|rfp|analytics)/)

  if (isProtected) {
    if (!accessToken) {
      return NextResponse.redirect(new URL('/login', req.url))
    }
    try {
      const payload = decodeJwt(accessToken)   // jose, no signature verify at edge
      if (payload.exp! * 1000 < Date.now()) {
        // Access token expired — let client attempt silent refresh
        return NextResponse.redirect(new URL('/login?refresh=1', req.url))
      }
      if (req.nextUrl.pathname.startsWith('/analytics') && payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/chat', req.url))
      }
    } catch {
      return NextResponse.redirect(new URL('/login', req.url))
    }
  }
  if (accessToken && req.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/chat', req.url))
  }
}
```

```typescript
// app/layout.tsx — rehydrate auth on every cold load
// On mount: call GET /auth/me (browser sends im_refresh cookie automatically via /auth/refresh first)
// Pattern: app loads → if no in-memory token → POST /auth/refresh → on success: setAuth() → render app
// This gives seamless re-login after page refresh without ever storing access token in localStorage
```

**On `/login?refresh=1`**: The login page checks for the `refresh=1` query param on mount, silently attempts `POST /auth/refresh` (browser sends httpOnly cookie), and if successful redirects to the originally requested page — the user never sees the login form.

**Logout flow**:
```typescript
async function logout() {
  await authApi.logout()         // POST /auth/logout — server revokes all refresh tokens
  authStore.clear()              // Clear in-memory access token
  document.cookie = 'im_access=; max-age=0; path=/'   // Clear access cookie
  // im_refresh cookie is cleared by server Set-Cookie response
  router.push('/login')
}
```

**Password hashing** (backend): bcrypt with 12 salt rounds. On user create: `hash_password(plain)`. On login: `verify_password(plain, stored_hash)`.

**Forced re-login triggers**:
- Admin deactivates a user (`is_active = false`) → all refresh tokens revoked
- Admin resets a user's password → all refresh tokens revoked
- User's refresh token expires (7 days) → must re-enter credentials

---

**Qdrant Collection Setup**
```python
# qdrant_client setup at app startup (dependencies.py)
from qdrant_client import AsyncQdrantClient
from qdrant_client.models import (
    VectorParams, Distance, SparseVectorParams, Modifier
)

async def init_qdrant(client: AsyncQdrantClient):
    exists = await client.collection_exists("imocha_kb")
    if not exists:
        await client.create_collection(
            collection_name="imocha_kb",
            vectors_config={
                "dense": VectorParams(size=3072, distance=Distance.COSINE)
            },
            sparse_vectors_config={
                "sparse": SparseVectorParams(modifier=Modifier.IDF)
            }
        )
```

---

### Step 1.2 — Document Ingestion Pipeline (Week 2)

**Tools used**: `unstructured[all-docs]`, `openai`, `qdrant-client`, `python-docx`

**Parser (`core/ingestion/parser.py`)**
- [ ] Use `unstructured.partition.auto.partition()` — auto-detects file type, extracts structured elements
- [ ] For PDF: extracts Title, NarrativeText, Table, ListItem elements with page numbers
- [ ] For DOCX: respects heading hierarchy (H1/H2 = section boundary markers)
- [ ] For TXT: plain text extraction, split on double newlines
- [ ] Attach `section` name (nearest heading above the element) to each element
- [ ] Return a list of `ParsedElement(text, element_type, section, page_number, doc_id)`

> Rule: Never use `PyPDF2`. It loses table structure and column layout.

**Chunker (`core/ingestion/chunker.py`)**
- [ ] Implement Parent-Document Retriever:
  - **Child chunks**: 250 tokens, 25-token overlap → stored as vectors in Qdrant for retrieval
  - **Parent chunks**: 700 tokens → stored in Qdrant payload, sent to LLM as context
- [ ] Use `tiktoken` (cl100k_base encoding) for accurate token counting
- [ ] Chunk payload structure per child chunk:
```python
{
    "doc_id":          "<uuid>",
    "doc_name":        "iMocha_Product_Overview.pdf",
    "doc_type":        "pdf",
    "category":        "Product Docs",
    "section":         "2.1 Assessment Library",
    "page_number":     4,
    "chunk_index":     12,
    "child_text":      "...",     # 250 tokens: used for retrieval
    "parent_text":     "...",     # 700 tokens: sent to LLM
    "date_ingested":   "2026-03-09"
}
```

**Embedder (`core/rag/embedder.py`)**
- [ ] Async OpenAI embeddings: `model="text-embedding-3-large"`, `dimensions=3072`
- [ ] Batch in groups of 100 to avoid rate limits during ingestion
- [ ] Returns `list[list[float]]` aligned with input chunk list

**Indexer (`core/ingestion/indexer.py`)**
- [ ] Build BM25 sparse vectors from child text using `qdrant_client.models.SparseVector`
- [ ] Upsert to Qdrant: each point has `id` (UUID), `vector.dense`, `vector.sparse`, `payload`
- [ ] On document delete: `client.delete(collection_name="imocha_kb", points_selector=Filter(must=[FieldCondition(key="doc_id", match=MatchValue(value=doc_id))]))`
- [ ] Update PostgreSQL `documents.chunk_count` and `documents.status = "indexed"` after successful upsert

---

### Step 1.3 — RAG Query Pipeline (Week 2–3)

**Tools used**: `qdrant-client`, `cohere`, `anthropic`

**Retriever (`core/rag/retriever.py`)**
```python
async def hybrid_search(query: str, top_k: int = 20) -> list[ScoredPoint]:
    query_dense_vec = await embedder.embed(query)
    query_sparse_vec = build_bm25_vector(query)

    results = await qdrant.query_points(
        collection_name="imocha_kb",
        prefetch=[
            Prefetch(query=query_dense_vec, using="dense", limit=top_k),
            Prefetch(query=query_sparse_vec, using="sparse", limit=top_k),
        ],
        query=FusionQuery(fusion=Fusion.RRF),  # Reciprocal Rank Fusion
        limit=top_k
    )
    return results.points
```

**Reranker (`core/rag/reranker.py`)**
```python
async def rerank(query: str, results: list[ScoredPoint], top_n: int = 5):
    docs = [r.payload["child_text"] for r in results]
    reranked = cohere_client.rerank(
        model="rerank-v4-nimble",
        query=query,
        documents=docs,
        top_n=top_n,
        return_documents=True
    )
    # Return top-n chunks with relevance scores, mapped back to original payloads
    return [(results[r.index], r.relevance_score) for r in reranked.results]
```

**CRAG Evaluator (`core/rag/evaluator.py`)**
```python
RELEVANCE_THRESHOLD = 0.40

def evaluate(reranked: list[tuple]) -> tuple[bool, list]:
    above = [(chunk, score) for chunk, score in reranked if score >= RELEVANCE_THRESHOLD]
    if not above:
        return False, []   # triggers fallback — no LLM call
    return True, above
```

**System Prompts (`core/llm/prompts.py`)**
```python
CHAT_SYSTEM_PROMPT = """
You are iMocha's internal AI assistant.
You ONLY answer based on the document context provided to you.

Non-negotiable rules:
1. Never invent, infer, or speculate beyond what is explicitly in the context.
2. If the context is insufficient, respond with exactly:
   "This information is not currently available in iMocha's knowledge base.
    Please reach out to the relevant iMocha team for further details."
3. Cite every factual claim with the source document name and section.
4. Do not answer questions unrelated to iMocha's products, services, or policies.
5. Be professional, concise, and direct.
"""

ANALYSIS_SYSTEM_PROMPT = """
You are iMocha's solution analyst AI.
Analyse the client requirements provided against iMocha's knowledge base context.

Output a JSON object with exactly this structure:
{
  "in_scope": [{"point": "...", "source": "doc_name / section"}],
  "out_of_scope": [{"point": "...", "source": "doc_name / section or null"}],
  "future_scope": [{"point": "...", "source": "doc_name / section or null"}]
}

Rules:
1. Only include points that are directly supported by or clearly absent from the context.
2. Do not speculate about future capabilities unless the KB explicitly mentions a roadmap.
3. out_of_scope points must state "Not currently supported by iMocha" as the finding.
"""

RFP_SYSTEM_PROMPT = """
You are iMocha's pre-sales AI assistant.
Generate a professional RFP response using ONLY facts from the provided knowledge base context.

Structure your response as JSON:
{
  "executive_summary": "...",
  "solution_overview": "...",
  "compliance_matrix": [{"requirement": "...", "imocha_capability": "...", "status": "supported|partial|not_supported"}],
  "pricing": "...",          // omit if not in KB
  "implementation_timeline": "..."  // omit if not in KB
}

Rules:
1. Every claim must cite the KB. No invented facts.
2. For unsupported requirements, set status to "not_supported" and capability to "Not currently offered by iMocha."
3. Use formal B2B proposal language.
"""
```

**Claude Client (`core/llm/claude_client.py`)**
```python
async def generate(query: str, chunks: list, system_prompt: str) -> dict:
    # Pass parent_text as citation-enabled document blocks
    content = [{"type": "text", "text": query}]
    for chunk, score in chunks:
        content.append({
            "type": "document",
            "source": {"type": "text", "media_type": "text/plain", "data": chunk.payload["parent_text"]},
            "title": f"{chunk.payload['doc_name']} — {chunk.payload['section']}",
            "citations": {"enabled": True}
        })

    response = await anthropic_client.beta.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1500,
        system=system_prompt,
        messages=[{"role": "user", "content": content}],
        betas=["citations-2025-04-04"]
    )
    return parse_response(response)   # extract text + citations list
```

**Confidence Scoring (`core/llm/confidence.py`)**
```python
def compute_confidence(rerank_scores: list[float]) -> str:
    top = max(rerank_scores)
    if top >= 0.8:   return "high"
    elif top >= 0.5: return "medium"
    else:            return "low"
```

**Full Pipeline (`core/rag/pipeline.py`)**
```
async def run_chat_pipeline(query: str) -> ChatPipelineResult:
    # Step 1: Retrieve
    raw_results = await retriever.hybrid_search(query, top_k=20)
    if not raw_results:
        return ChatPipelineResult(found=False)

    # Step 2: Rerank
    reranked = await reranker.rerank(query, raw_results, top_n=5)

    # Step 3: CRAG Gate
    passed, relevant = evaluator.evaluate(reranked)
    if not passed:
        return ChatPipelineResult(found=False)

    # Step 4: Generate
    result = await claude_client.generate(query, relevant, CHAT_SYSTEM_PROMPT)

    # Step 5: Score
    scores = [score for _, score in relevant]
    confidence = compute_confidence(scores)

    return ChatPipelineResult(found=True, answer=result["text"],
                              citations=result["citations"], confidence=confidence)
```

---

### Step 1.4 — Knowledge Base CRUD API (Week 3)

**Tools**: `boto3` (S3), `unstructured`, `sqlalchemy`, `qdrant-client`

**Endpoints (`api/knowledge_base.py`)**

| Method | Endpoint | Action |
|---|---|---|
| POST | `/api/kb/upload` | Upload file → S3/local → parse → chunk → embed → index Qdrant → insert PostgreSQL |
| GET | `/api/kb/files` | List all documents from PostgreSQL (with pagination + category filter) |
| GET | `/api/kb/files/{id}` | Get single document metadata from PostgreSQL |
| GET | `/api/kb/files/{id}/preview` | Return first 2000 chars of extracted text (from Qdrant payload) |
| PUT | `/api/kb/files/{id}` | Re-upload: delete old chunks from Qdrant → re-index → update PostgreSQL |
| DELETE | `/api/kb/files/{id}` | Delete from S3 + Qdrant (by doc_id filter) + PostgreSQL |

**Rules**:
- Max file size: 25MB enforced at API level
- Accepted types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `text/plain`
- On upload: set `status = "processing"` immediately, then run ingestion async, then `status = "indexed"` or `"error"`
- On delete: always delete from Qdrant first; if Qdrant fails, do not delete from PostgreSQL (keeps data consistent)

---

### Step 1.5 — Chat API (Week 3)

**Endpoints (`api/chat.py`)**

| Method | Endpoint | Action |
|---|---|---|
| POST | `/api/chat` | Run RAG pipeline → save message pair to PostgreSQL → return response |
| GET | `/api/chat/sessions` | List user's sessions (most recent first) |
| GET | `/api/chat/sessions/{id}` | Get full message history for a session |
| DELETE | `/api/chat/sessions/{id}` | Delete session + all messages (CASCADE) |

**Request / Response Schemas**
```python
class ChatRequest(BaseModel):
    session_id: Optional[str] = None   # null = create new session
    message: str

class Citation(BaseModel):
    doc_name: str
    section: str
    page_number: Optional[int]
    quote: str

class ChatResponse(BaseModel):
    session_id: str
    answer: str
    citations: list[Citation]
    confidence: Literal["high", "medium", "low", "not_found"]
```

---

### Step 1.6 — Frontend: Auth + Dashboard Shell + Chat + KB (Week 4–5)

**Auth: Login Page (`app/(auth)/login/page.tsx`)**
- [ ] Full-viewport split-screen layout: left 60% = brand panel, right 40% = form panel
- [ ] Left panel: gradient `#1C0A38 → #2D1252`, iMocha logo (large, centered), tagline, decorative mesh SVG
- [ ] Right panel: white card with shadow; `<LoginForm>` (RHF + Zod: email + password); submit button with loading spinner; shadcn `<Alert>` for auth errors
- [ ] On successful `POST /auth/login` (`withCredentials: true`): server sets `im_refresh` httpOnly cookie automatically; frontend receives `{ access_token, user }` in response body
- [ ] Store access token in `authStore` (memory only, NOT localStorage); mirror to `im_access` cookie (readable by Next.js middleware): `document.cookie = 'im_access=...; max-age=900; path=/; SameSite=Strict'`; then `router.push('/chat')`
- [ ] On cold page reload (no in-memory token): `app/layout.tsx` calls `POST /auth/refresh` on mount (browser auto-sends `im_refresh` httpOnly cookie); on success: rehydrate `authStore`; on failure: redirect to `/login`
- [ ] On `/login?refresh=1`: silently attempt `POST /auth/refresh` before showing form — if succeeds, redirect back to intended page without user interaction
- [ ] Mobile: single centered card on purple gradient background
- [ ] Animate right panel with Framer Motion `animate-fade-up` on mount

**Dashboard Shell (`app/(dashboard)/layout.tsx`)**
- [ ] `<AppSidebar>`: background `#1C0A38`, logo at top, nav sections (Core + Admin), collapsible (260px ↔ 68px icon-only), `<SidebarChatHistory>` below Chat link
- [ ] Active nav item: left `border-l-2 border-im-orange` + orange text + `bg-im-orange/10` tint
- [ ] `<TopHeader>`: shadcn `<Breadcrumb>` (left) + `<UserMenu>` avatar dropdown (right); sticky, 64px, white with `border-b border-im-purple/10`
- [ ] `<UserMenu>`: avatar initials circle + name + role badge + dropdown with Profile / Logout
- [ ] Sidebar collapse persisted in `uiStore`; Framer Motion spring width transition

**Chat Pages (`app/(dashboard)/chat/` + `[sessionId]/`)**
- [ ] `shadcn <ResizablePanelGroup>`: left panel (30%, min 240px) = `<SessionList>`; right panel = `<ChatThread>` + `<ChatInput>`
- [ ] `<SessionList>`: search input + "New Chat" button + session list; active session: orange left border + purple-tinted bg; `<SidebarChatHistory>` reused component
- [ ] `<ChatMessage>`: user bubble (right-aligned, `bg-im-orange`, white text, user initials avatar); assistant card (left-aligned, white, shadow-card, iMocha "I" avatar in `bg-im-purple`)
- [ ] Assistant messages: `<MarkdownRenderer>` → row of `<CitationBadge>` pills → `<ConfidenceBadge>` → timestamp + `<CopyButton>`
- [ ] `<CitationBadge>`: small pill, hover expands to show doc name; click opens `<CitationSheet>` (shadcn Sheet from right) with excerpt + metadata
- [ ] `<ConfidenceBadge>`: `high (≥0.85)` green, `medium (0.6–0.85)` amber, `low (<0.6)` red — all show text label
- [ ] `<FallbackCard>`: amber bordered card with icon for "not in KB" responses
- [ ] `<StreamingIndicator>`: 3-dot Framer Motion stagger while awaiting SSE response
- [ ] `<EmptyChatState>`: welcome illustration + 3 suggested prompt cards with glassmorphism effect
- [ ] `<ChatInput>`: auto-resize textarea (max 6 rows), send on Cmd+Enter / Ctrl+Enter, Shift+Enter for newline
- [ ] `useChatStream` hook: manages SSE chunks, invalidates TanStack Query cache on completion
- [ ] Chat messages animate in with `initial={{ opacity:0, y:12 }} animate={{ opacity:1, y:0 }}`, staggered

**Knowledge Base Page (`app/(dashboard)/knowledge-base/page.tsx`)**
- [ ] `<UploadDropzone>`: react-dropzone — accept PDF/DOCX/TXT, max 25MB; drag-over state: `border-im-orange bg-im-orange/5`; shows `<UploadProgressCard>` per in-flight file
- [ ] `<UploadProgressCard>`: filename + formatted size + animated progress bar (im-orange) + status text
- [ ] `<DocumentTable>`: shadcn Table columns: checkbox, Name, Type, Size, Chunks, Status, Uploaded, Actions
- [ ] `<DocumentStatusBadge>`: "Processing" (amber + animated spinner) / "Indexed" (green) / "Failed" (red + retry)
- [ ] `<DocumentPreviewSheet>`: shadcn Sheet full-height from right; metadata header + `<ScrollArea>` with extracted text
- [ ] `<DeleteDocumentDialog>`: shadcn AlertDialog — "This will permanently remove the document and all its indexed chunks."
- [ ] Bulk action bar: appears when checkboxes selected — "X selected" + Delete + Re-index buttons
- [ ] `useDocuments` hook: TQ invalidation on every mutation; optimistic delete (row disappears instantly, restored on error)
- [ ] Role enforcement: upload/delete/reindex buttons hidden for Sales role (checked via `authStore.isAdmin()`)

---

### Step 1.7 — Testing & Phase 1 QA (Week 6)

**Backend Tests**
- [ ] `test_ingestion.py`: upload PDF → verify Qdrant chunk count matches expected
- [ ] `test_rag_pipeline.py`: mock Qdrant + Cohere + Anthropic → verify pipeline output shape
- [ ] `test_api_chat.py`: POST /chat with valid + empty KB → verify fallback triggers
- [ ] `test_api_kb.py`: upload → list → preview → delete → verify Qdrant cleanup

**Manual QA Checklist**
- [ ] Upload 5 real iMocha docs (mix of PDF, DOCX, TXT)
- [ ] Ask 10 in-scope questions — verify answers are grounded with citations
- [ ] Ask 5 out-of-scope questions — verify fallback message appears, no hallucination
- [ ] Delete a file — verify its answers no longer appear in chat
- [ ] Full Docker Compose startup from scratch: `docker compose up --build`

**Phase 1 Deliverable**: Grounded chatbot + KB CRUD, running in Docker, no hallucinations verified.

---

## Phase 2 — Analysis Engine + RFP Module
**Duration: 3–4 weeks**
**Goal: Client-facing analysis reports and professional RFP generation/response.**

---

### Step 2.1 — Analysis Engine (Week 7–8)

**Tools**: `anthropic`, `qdrant-client`, `reportlab`, `python-docx`

**Logic (`services/analysis_service.py`)**
1. Accept client criteria text
2. Run `run_chat_pipeline(criteria)` with `ANALYSIS_SYSTEM_PROMPT`
3. Parse Claude's JSON output into `AnalysisResult(in_scope, out_of_scope, future_scope)`
4. Save to a new `analyses` PostgreSQL table
5. Return structured response

**New PostgreSQL Table**
```sql
CREATE TABLE analyses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       TEXT NOT NULL,
    client_name   TEXT,
    criteria_text TEXT NOT NULL,
    result_json   JSONB NOT NULL,    -- {in_scope, out_of_scope, future_scope}
    created_at    TIMESTAMPTZ DEFAULT now()
);
```

**Endpoints (`api/analysis.py`)**

| Method | Endpoint | Action |
|---|---|---|
| POST | `/api/analysis` | Submit criteria → run RAG → return structured 3-column result |
| GET | `/api/analysis/history` | List past analyses for the user |
| GET | `/api/analysis/{id}` | Retrieve a specific analysis |
| POST | `/api/analysis/{id}/export` | Export as PDF or DOCX |

**Frontend: Analysis Page (`app/(dashboard)/analysis/page.tsx`)**
- [ ] Sticky left panel (360px): `<CriteriaForm>` — RHF+Zod textarea + optional client name field + "Run Analysis" button (full-width, loading spinner state)
- [ ] Below form: `<AnalysisHistory>` — last 5 analyses as clickable list items; click to re-load result into right panel
- [ ] Right panel: `<AnalysisResultHeader>` with criteria summary + model info + timestamp + `<ExportMenu>` dropdown
- [ ] `<ScopeColumns>`: 3-column CSS grid — "In Scope" (green header), "Out of Scope" (red header), "Future Scope" (amber header)
- [ ] Each `<ScopeCard>`: white card, colored left border, item text, expand button to show LLM reasoning, citation chips at bottom
- [ ] Loading state: skeleton grid (3 cols × 4 cards) with shimmer — do NOT show spinner
- [ ] Scope columns stagger in left-to-right with 0.1s Framer Motion delay per column
- [ ] `<ExportMenu>`: shadcn DropdownMenu — "Export as PDF", "Export as CSV", "Copy as Markdown"

---

### Step 2.2 — RFP Module (Week 8–9)

**Tools**: `anthropic`, `python-docx`, `reportlab`

**New PostgreSQL Table**
```sql
CREATE TABLE rfp_responses (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL,
    mode            TEXT NOT NULL CHECK (mode IN ('responder', 'generator')),
    input_text      TEXT NOT NULL,
    result_json     JSONB NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT now()
);
```

**Mode A — RFP Responder**
- Input: raw RFP text (pasted or uploaded as TXT/DOCX)
- System extracts requirements from RFP using a pre-pass Claude call
- Runs RAG against each extracted requirement
- Outputs compliance matrix + full response document

**Mode B — RFP Generator**
- Input: structured form (client name, industry, requirements list as bullet points)
- Runs RAG on full requirement set
- Outputs complete proposal-structured JSON → rendered as formatted document

**Endpoints (`api/rfp.py`)**

| Method | Endpoint | Action |
|---|---|---|
| POST | `/api/rfp/respond` | Paste RFP text → extract requirements → RAG → structured response |
| POST | `/api/rfp/generate` | Form inputs → RAG → full proposal JSON |
| GET | `/api/rfp/history` | List past RFP responses |
| GET | `/api/rfp/{id}` | Retrieve a specific RFP response |
| POST | `/api/rfp/{id}/export` | Export to DOCX or PDF |

**Frontend: RFP Page (`app/(dashboard)/rfp/page.tsx`)**
- [ ] `<RFPModeTabs>`: shadcn Tabs at top — "Respond to RFP" | "Generate Proposal"; persisted in `uiStore.rfpMode`
- [ ] **Responder tab**: `<RFPResponderInput>` — large textarea for paste + optional react-dropzone for TXT/DOCX upload; "Generate Response" button
- [ ] **Generator tab**: `<RFPGeneratorForm>` — RHF+Zod fields: client name, project name, industry (shadcn Select), submission deadline, dynamic requirements list (add/remove rows), tone selector (Toggle); "Generate RFP" button
- [ ] `<RFPOutputPanel>`: appears after submission — sections rendered as shadcn Accordion (collapsible): Executive Summary, Solution Overview, Compliance Matrix, Pricing Notes, Implementation Timeline
- [ ] `<ComplianceMatrix>`: shadcn Table — columns: Requirement, iMocha Capability, Status; status cell color-coded: `supported` (green badge), `partial` (amber badge), `not_supported` (red badge)
- [ ] Each RFP section has an inline "Regenerate" icon button to re-call the API for just that section
- [ ] `<ExportRFPButton>`: "Download DOCX" (Phase 2) + "Copy Markdown" (Phase 1)
- [ ] `<RFPHistory>`: collapsible sidebar panel with past responses — click to restore output

---

### Step 2.3 — Testing & Phase 2 QA (Week 10)

- [ ] Test analysis with 5 real client requirement sets
- [ ] Verify every analysis bullet has a citation from the KB
- [ ] Test RFP responder with a real-world sample RFP document
- [ ] Test RFP generator form → verify output uses only KB facts
- [ ] Test PDF and DOCX exports: correct formatting, all sections present
- [ ] Regression: re-run Phase 1 chat tests to confirm no regressions

**Phase 2 Deliverable**: Complete platform with chat + KB + analysis + RFP + exportable outputs.

---

## Phase 3 — Enterprise Features
**Duration: 3–4 weeks**
**Goal: RBAC, analytics dashboard, deployment pipeline, production-ready.**

---

### Step 3.1 — Role-Based Access Control (Week 11)

**Tools**: `python-jose`, `passlib[bcrypt]` (already implemented in Phase 1 auth module)

**Roles & Permissions**

| Role | Chat | KB View | KB Upload/Delete | Analysis | RFP | Analytics | User Mgmt |
|---|---|---|---|---|---|---|---|
| Admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Sales / Pre-sales | ✓ | ✓ | ✗ | ✓ | ✓ | ✗ | ✗ |

**Backend Implementation** (role is embedded in the access token — no extra DB call per request)
```python
# dependencies.py — already built in Phase 1, reused here
from app.core.auth.tokens import decode_access_token

async def get_current_user(token = Depends(HTTPBearer()), db = Depends(get_db)):
    payload = decode_access_token(token.credentials)   # raises JWTError if invalid/expired
    return await db.get(User, payload["sub"])

async def require_admin(user = Depends(get_current_user)):
    if user.role != "admin":
        raise HTTPException(403, "Admin access required")
    return user

# Usage in KB CRUD routes (no change from Phase 1 setup):
@router.post("/upload",      dependencies=[Depends(require_admin)])
@router.put("/files/{id}",   dependencies=[Depends(require_admin)])
@router.delete("/files/{id}", dependencies=[Depends(require_admin)])

# Analytics routes:
@router.get("/analytics/summary", dependencies=[Depends(require_admin)])
```

**Frontend Implementation**
```typescript
// middleware.ts — edge runtime, runs before every request
import { NextRequest, NextResponse } from 'next/server'
import { decodeJwt } from 'jose'

export function middleware(req: NextRequest) {
  const token = req.cookies.get('im_hub_token')?.value
  const isProtected = req.nextUrl.pathname.startsWith('/chat') ||
                      req.nextUrl.pathname.startsWith('/knowledge-base') ||
                      req.nextUrl.pathname.startsWith('/analysis') ||
                      req.nextUrl.pathname.startsWith('/rfp') ||
                      req.nextUrl.pathname.startsWith('/analytics')

  if (isProtected && !token) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  if (token) {
    const payload = decodeJwt(token)
    // Check expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      const response = NextResponse.redirect(new URL('/login', req.url))
      response.cookies.delete('im_hub_token')
      return response
    }
    // Enforce admin-only analytics route
    if (req.nextUrl.pathname.startsWith('/analytics') && payload.role !== 'admin') {
      return NextResponse.redirect(new URL('/chat', req.url))
    }
    // Redirect authenticated users away from login
    if (req.nextUrl.pathname === '/login') {
      return NextResponse.redirect(new URL('/chat', req.url))
    }
  }
}

// AuthGuard.tsx — secondary client-side check (belt-and-suspenders)
export function AuthGuard({ children, requireAdmin = false }) {
  const { user } = useAuthStore()
  const router = useRouter()
  useEffect(() => {
    if (!user) router.replace('/login')
    if (requireAdmin && user?.role !== 'admin') router.replace('/chat')
  }, [user, requireAdmin])
  return user ? children : <LoadingPage />
}
```

---

### Step 3.2 — Query Analytics Dashboard (Week 11–12)

**Tools**: `sqlalchemy`, `recharts`

Sourced from the `query_logs` PostgreSQL table populated since Phase 1.

**Endpoints (`api/analytics.py`)**

| Method | Endpoint | Response |
|---|---|---|
| GET | `/api/analytics/summary` | Total queries, answer rate, top document, avg confidence |
| GET | `/api/analytics/volume` | Query counts per day (last 30 days) |
| GET | `/api/analytics/top-queries` | Top 10 most asked queries (fuzzy-grouped) |
| GET | `/api/analytics/gaps` | Top 10 unanswered queries |
| GET | `/api/analytics/confidence` | Count per confidence level |
| GET | `/api/analytics/export` | Download full log as CSV |

**Frontend: Analytics Page (`app/(dashboard)/analytics/page.tsx`)** — Admin only
- [ ] `<AuthGuard requireAdmin>` wrapper as secondary check
- [ ] `<AnalyticsSkeleton>` shown during initial data fetch (full-page shimmer, not spinner)
- [ ] Top stats row: 4 `<StatCard>` components — "Total Queries", "Answer Rate", "Avg. Confidence", "Documents in KB" — each with icon, large metric number, trend badge (↑/↓ vs last week)
- [ ] Chart grid (2×2):
  - `<QueryVolumeChart>`: shadcn Chart LineChart — x = date, y = query count, last 30 days
  - `<ConfidenceDistChart>`: shadcn Chart BarChart — high/medium/low/not_found buckets
  - `<TopDocumentsTable>`: horizontal bar list of most-queried KB documents
  - Phase 3 stub: User Activity Heatmap placeholder card
- [ ] `<GapTable>`: shadcn Table — unanswered queries sorted by frequency; each row has "Add to KB" button (opens upload dialog pre-labelled with the topic)
- [ ] `<ExportCSVButton>`: triggers `GET /api/analytics/export` + browser download
- [ ] `useAnalytics` hook: TQ `refetchInterval: 300_000` (5 min auto-refresh)

---

### Step 3.3 — Smart KB Suggestions (Week 12)

**Tools**: `sqlalchemy`, `anthropic` (lightweight clustering call)

- A weekly background job (APScheduler) queries `query_logs` for `answer_found = false` in the last 7 days
- Groups similar queries using a Claude call: `"Group these failed queries by topic. Return JSON: [{topic, count, example_queries}]"`
- Stores results in a `kb_suggestions` table
- Admin sees a "KB Gaps" banner on the Knowledge Base page:
  > "8 unanswered queries about 'API integration'. Consider adding documentation."

```sql
CREATE TABLE kb_suggestions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic        TEXT NOT NULL,
    query_count  INTEGER NOT NULL,
    examples     JSONB,
    generated_at TIMESTAMPTZ DEFAULT now(),
    dismissed    BOOLEAN DEFAULT false
);
```

---

### Step 3.4 — Comparison Mode (Week 12)

**Logic**: User inputs two sets of client criteria in two side-by-side panels.
System runs two parallel `analysis_service.run_analysis()` calls using `asyncio.gather()`.
Output: side-by-side `<ScopeTable>` for both clients — same 3-column structure per client.

**Endpoint**: `POST /api/analysis/compare` — accepts `{criteria_a: str, criteria_b: str, client_a: str, client_b: str}`

---

### Step 3.5 — Production Deployment (Week 13)

**Docker Compose (Production)**
```yaml
services:
  nginx:
    image: nginx:alpine
    ports: ["80:80", "443:443"]
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/ssl/certs
    depends_on: [backend, frontend]

  backend:
    build: ./backend
    env_file: .env.prod
    expose: ["8000"]
    depends_on: [postgres, qdrant]
    restart: unless-stopped

  frontend:
    build: ./frontend
    expose: ["3000"]
    restart: unless-stopped

  qdrant:
    image: qdrant/qdrant:latest
    expose: ["6333"]
    volumes: ["qdrant_data:/qdrant/storage"]
    restart: unless-stopped

  postgres:
    image: postgres:16-alpine
    env_file: .env.prod
    expose: ["5432"]
    volumes: ["pg_data:/var/lib/postgresql/data"]
    restart: unless-stopped

volumes:
  qdrant_data:
  pg_data:
```

**GitHub Actions CI/CD (`.github/workflows/deploy.yml`)**
```yaml
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run backend tests
        run: cd backend && pip install -r requirements.txt && pytest

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - name: Build and push Docker images
      - name: Deploy to production server (SSH or Railway/ECS)
```

**Pre-deployment Checklist**
- [ ] All secrets in `.env.prod`, never committed to git
- [ ] HTTPS enforced via Nginx TLS (Let's Encrypt or org cert)
- [ ] Qdrant persistent volume configured (data survives restarts)
- [ ] PostgreSQL daily backups enabled (pg_dump to S3)
- [ ] Rate limiting active: `slowapi` on all endpoints
- [ ] `GET /health` returns Postgres + Qdrant status
- [ ] Logging via structlog → CloudWatch / Datadog
- [ ] `ENVIRONMENT=production` disables debug mode and SQL echo

---

### Step 3.6 — Final QA & Load Testing (Week 14)

- [ ] End-to-end test: all 4 modules with real iMocha production documents
- [ ] RBAC: verify Sales user cannot upload, delete, or access analytics
- [ ] Load test: 50 concurrent users, Locust — target < 3s P95 response on chat
- [ ] Security: check SQL injection on all text inputs, JWT bypass attempts, file upload content validation
- [ ] Browser compatibility: Chrome, Firefox, Safari, Edge (latest)
- [ ] Mobile responsiveness: test on 375px viewport (sales team on phones)

**Phase 3 Deliverable**: Production-ready, enterprise-deployed, secured, monitored platform.

---

## Complete API Reference

| Method | Endpoint | Auth Required | Role | Description |
|---|---|---|---|---|
| GET | `/health` | No | — | Service health check |
| POST | `/auth/login` | No | — | Email + password → access token (body) + refresh token (httpOnly cookie) |
| POST | `/auth/refresh` | Cookie only | — | Exchange refresh token cookie → new access token + rotated refresh cookie |
| POST | `/auth/logout` | Yes | Any | Revoke all user's refresh tokens, clear cookie |
| GET | `/auth/me` | Yes | Any | Return current user's profile (id, name, email, role) |
| GET | `/settings/users` | Yes | Admin | List all org users |
| POST | `/settings/users` | Yes | Admin | Create new user (name, email, password, role) |
| PATCH | `/settings/users/{id}` | Yes | Admin | Update name / role / active status |
| DELETE | `/settings/users/{id}` | Yes | Admin | Deactivate user + revoke all their tokens |
| POST | `/settings/users/{id}/reset-password` | Yes | Admin | Set new password + revoke all refresh tokens |
| POST | `/api/chat` | Yes | Any | Send chat message, get RAG response |
| GET | `/api/chat/sessions` | Yes | Any | List user's chat sessions |
| GET | `/api/chat/sessions/{id}` | Yes | Any | Get session message history |
| DELETE | `/api/chat/sessions/{id}` | Yes | Any | Delete session |
| POST | `/api/kb/upload` | Yes | Admin | Upload + index new document |
| GET | `/api/kb/files` | Yes | Any | List all documents |
| GET | `/api/kb/files/{id}` | Yes | Any | Get document metadata |
| GET | `/api/kb/files/{id}/preview` | Yes | Any | Preview extracted text |
| PUT | `/api/kb/files/{id}` | Yes | Admin | Re-upload + re-index document |
| DELETE | `/api/kb/files/{id}` | Yes | Admin | Delete document |
| POST | `/api/analysis` | Yes | Any | Run client criteria analysis |
| GET | `/api/analysis/history` | Yes | Any | List past analyses |
| GET | `/api/analysis/{id}` | Yes | Any | Get specific analysis |
| POST | `/api/analysis/{id}/export` | Yes | Any | Export analysis (PDF/DOCX) |
| POST | `/api/analysis/compare` | Yes | Any | Side-by-side two-client analysis |
| POST | `/api/rfp/respond` | Yes | Any | RFP responder |
| POST | `/api/rfp/generate` | Yes | Any | RFP generator |
| GET | `/api/rfp/history` | Yes | Any | List past RFP responses |
| GET | `/api/rfp/{id}` | Yes | Any | Get specific RFP response |
| POST | `/api/rfp/{id}/export` | Yes | Any | Export RFP (PDF/DOCX) |
| GET | `/api/analytics/summary` | Yes | Admin | Analytics overview stats |
| GET | `/api/analytics/volume` | Yes | Admin | Daily query volume chart data |
| GET | `/api/analytics/top-queries` | Yes | Admin | Top asked queries |
| GET | `/api/analytics/gaps` | Yes | Admin | Unanswered queries |
| GET | `/api/analytics/confidence` | Yes | Admin | Confidence score distribution |
| GET | `/api/analytics/export` | Yes | Admin | Download full log as CSV |

---

## Environment Variables

```env
# ── LLM & AI ──────────────────────────────────────────────
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
COHERE_API_KEY=...

# ── Vector DB (Qdrant) ────────────────────────────────────
QDRANT_URL=http://localhost:6333      # http://qdrant:6333 in Docker
QDRANT_API_KEY=                       # required for Qdrant Cloud only
QDRANT_COLLECTION=imocha_kb

# ── Relational DB (PostgreSQL) ────────────────────────────
DATABASE_URL=postgresql+asyncpg://imocha:password@localhost:5432/imocha_hub
POSTGRES_USER=imocha
POSTGRES_PASSWORD=password
POSTGRES_DB=imocha_hub

# ── File Storage ──────────────────────────────────────────
STORAGE_BACKEND=local                 # local | s3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=ap-south-1
AWS_S3_BUCKET=imocha-hub-docs
LOCAL_UPLOAD_DIR=./uploads            # used when STORAGE_BACKEND=local

# ── Auth (Self-hosted JWT) ────────────────────────────────
JWT_SECRET=<minimum-32-char-random-secret>   # openssl rand -hex 32
ACCESS_TOKEN_EXPIRE_MINUTES=15               # short-lived: 15 min
REFRESH_TOKEN_EXPIRE_DAYS=7                  # long-lived: 7 days
BCRYPT_ROUNDS=12                             # bcrypt salt rounds

# ── Default Admin (seeded on first boot) ──────────────────
ADMIN_EMAIL=admin@imocha.io
ADMIN_PASSWORD=<strong-password>
ADMIN_NAME=Platform Admin

# ── App Config ────────────────────────────────────────────
ENVIRONMENT=development               # development | production
CORS_ORIGINS=http://localhost:3000
CORS_ALLOW_CREDENTIALS=true           # required for httpOnly cookie on /auth/refresh
LOG_LEVEL=INFO
MAX_FILE_SIZE_MB=25
CRAG_RELEVANCE_THRESHOLD=0.40
RETRIEVAL_TOP_K=20
RERANK_TOP_N=5

# ── Frontend ──────────────────────────────────────────────
NEXT_PUBLIC_API_URL=http://localhost:8000   # backend URL for Axios client
```

---

## Phased Summary

| Phase | Duration | Key Deliverables |
|---|---|---|
| Phase 1 — MVP | 4–6 weeks | Grounded chatbot, KB CRUD, CRAG pipeline, Docker setup |
| Phase 2 — Analysis + RFP | 3–4 weeks | Analysis engine, RFP responder + generator, PDF/DOCX export |
| Phase 3 — Enterprise | 3–4 weeks | RBAC, analytics dashboard, smart suggestions, CI/CD, production deploy |
| **Total** | **~14 weeks** | **Production-ready, org-deployable enterprise platform** |

---

*iMocha Intelligence Hub | Implementation Plan | March 2026*
