# Zero-Hallucination RAG + Security Hardening — Design Spec
**Date:** 2026-03-11
**Approach:** Approach B — Structured RAG + Verification Layer
**Status:** Approved for implementation

---

## Context

Replacing a custom GPT that hallucinates across all failure modes (invents facts, mixes documents, overconfident no-answer). Core goal: answers strictly from the KB, zero hallucinations, tight security for sensitive company data.

**KB:** ~15 files (DOCX, TXT, some PDF), section-structured with Q&A pairs in some files.
**Users:** Admin (KB CRUD + all features), Sales reps (chat/RFP/analysis — consume only).
**No-answer behaviour (MVP):** Hard stop — fixed message, no LLM call.
**RFP unanswered questions:** Flag with "not in KB" marker, leave slot for human to fill.

## Branch Strategy

**Single branch: `feature/zero-hallucination-security`**
All changes are implemented sequentially on one branch and merged to `main` once. No parallel branches — all sections touch overlapping files (`config.py`, `core/rag/`, `core/ingestion/`, `api/`, `main.py`) and parallel branches would cause merge conflicts.

---

## Implementation Steps (sequential, all on `feature/zero-hallucination-security`)

| Step | Description | Blocked by |
|------|-------------|-----------|
| 1 | Create branch + raise retrieval thresholds | — |
| 2 | Query preprocessing + prompt injection defense | Step 1 |
| 3 | Security hardening | Step 2 |
| 4 | Q&A-aware ingestion + new Qdrant collection | Step 3 |
| 5 | Post-generation Haiku verification layer | Step 4 |
| 6 | Instruction set import with conflict detection | Step 5 |
| 7 | RFP unanswered question flagging | Step 5 |

---

## Section 1: Ingestion Pipeline
*(Step 4 on `feature/zero-hallucination-security`)*

### Changes
1. **Q&A-aware atomic chunking**: Pre-scan each document for Q&A patterns (`Q:`, `Question:`, bold question + answer paragraph, numbered Q&A lists). Keep question + answer as a single atomic chunk. Cap at 1200 tokens — log a warning if exceeded (source doc needs restructuring).
2. **Section-aware chunking for prose**: Chunk by section boundary first, then by token count within a section. A chunk never crosses a section heading. Child: 250 tokens, Parent: 700–1000 tokens.
3. **Metadata enrichment**: Every chunk tagged with `content_type` (qa_pair | prose | list | table), `section_title`, `doc_name`, `page_number`.
4. **Duplicate detection**: SHA-256 hash of chunk text on re-upload. Skip re-indexing if identical content exists.
5. **New Qdrant collection `imocha_kb_v2`**: Feature branch deploys to separate collection. Old collection untouched until validated.

### Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Q&A regex misses patterns in specific DOCX files | Medium | Test against all 15 files before deploy. Fallback to current chunker if no pattern detected |
| 1200-token cap silently truncates long Q&A pair | Low | Log warning — admin fixes source doc |
| Section boundary detection fails on poorly structured DOCX | Medium | Fall back to token-based chunking per document if no headings detected |
| Rebuilding Qdrant collection required | High (certain) | Deploy to `imocha_kb_v2` — validate before switching |
| SHA-256 collision | Very Low | Negligible at this scale |

---

## Section 2: Retrieval + CRAG Gate
*(Steps 1–2 on `feature/zero-hallucination-security`)*

### Changes
1. **Raise `CRAG_RELEVANCE_THRESHOLD`: `0.40` → `0.65`**: Tangentially related chunks no longer pass. Hard stop fires more aggressively — intentional for MVP.
2. **Raise `RERANK_TOP_N`: `5` → `8`**: More candidates in LLM context window. Handles answers spread across multiple chunks.
3. **`RETRIEVAL_TOP_K` stays at `20`**: Pool size is fine for a 15-file KB.
4. **Hard stop response fixed**: When no chunks pass threshold, return a fixed message before any LLM call:
   > *"I don't have this information in my knowledge base. Please contact your admin if this is something that should be covered."*
5. **Query preprocessing + prompt injection defense**:
   - Strip injection patterns: "ignore previous", "you are now", "pretend you are", system-role overrides
   - Wrap cleaned user query in XML delimiters: `<user_query>...</user_query>` — cannot be interpreted as an instruction by the LLM
   - Max input length: 2000 characters. Strip control characters.

### Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Threshold 0.65 too strict — legitimate queries hard-stopped | Medium | Monitor `answer_found=false` rate for 2 weeks. If >20%, tune to 0.60 |
| Raising RERANK_TOP_N increases cost | Low | Negligible for 15-file KB |
| Injection strip regex false-positives on sales queries | Low | Allowlist common sales phrases. Log stripped content for admin review |
| Users accustomed to current (looser) behaviour | Low | Test on staging with real queries before merge |

---

## Section 3: Post-Generation Verification Layer
*(Step 5 on `feature/zero-hallucination-security`)*

### Changes
1. **Post-generation Haiku verifier**: After Claude generates a response, before sending to user, call Claude Haiku with:
   > *"You are a fact-checker. Below is a response generated from a knowledge base, followed by the source chunks. Check if every factual claim is directly supported by the source chunks. Return JSON: `{ "verified": true/false, "unsupported_claims": ["..."] }`"*
2. **Three outcomes**:
   - `verified: true` → send as-is
   - `verified: false` → strip unsupported sentences, replace with: *"I was unable to verify this detail from my knowledge base."*
   - All content stripped → fire hard stop response
3. **Streaming compatibility**: Buffer complete response, run verification, then stream. Extend existing "thinking" indicator in UI. Added latency: ~300–500ms.
4. **RFP module**: Run verification per-answer in parallel (not on full document) to manage latency.
5. **Verification logging**: Every result (pass/fail, stripped claims) stored in query log. Admins can monitor verifier fire rate.

### Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Haiku over-strips correct answers (paraphrases) | Medium | Prompt: only flag claims with *no possible* support in chunks. Test against 50 known-good Q&A pairs before deploy |
| Latency unacceptable on RFP module | Medium | Parallel Haiku calls per RFP question |
| Streaming UX breaks | Low | Extend "thinking" indicator — no structural UI changes |
| Haiku cost | Low | Negligible at team scale (<$5/month estimated) |
| Verification prompt injected via KB content | Very Low | Wrap chunks in XML delimiters |

---

## Section 4: Security Hardening
*(Step 3 on `feature/zero-hallucination-security`)*

### Changes
1. **Per-user rate limiting**: Configure slowapi (already imported) — 30 requests/minute on chat, 10/minute on RFP/analysis per user.
2. **Qdrant API key**: Enable Qdrant authentication in docker-compose for production. API key stored in `.env`, never hardcoded.
3. **Audit logging**: Every query logged with user ID, timestamp, module (chat/rfp/analysis), `answer_found` flag. No query content stored (privacy). Separate `AuditLog` table.
4. **Input validation**: Max 2000 chars query length, strip control characters, block known injection patterns (from Section 2 — shared utility).
5. **CSP headers**: Add `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options` headers to FastAPI middleware.
6. **Refresh token hardening**: Verify `im_refresh` cookie is already `httpOnly=True`, `secure=True`, `samesite=strict` — patch if not.
7. **Admin-only KB enforcement**: Verify every document CRUD endpoint uses `require_admin()` dependency. Add integration test to assert 403 for non-admin users.
8. **Secrets documentation**: Document migration path from `.env` to AWS Secrets Manager / GCP Secret Manager for cloud deployment.

### Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Rate limits block legitimate bulk RFP use | Medium | Per-user limits, not global. RFP limit set per-call not per-question |
| Qdrant auth breaks existing local dev setup | Low | Auth only enforced in `ENVIRONMENT=production`. Dev uses no-auth as now |
| CSP headers break frontend assets | Medium | Test thoroughly on staging. Start with report-only mode |
| Audit log table grows unbounded | Low | Add 90-day retention policy with a cleanup job |

---

## Section 5: Instruction Set Integration
*(Step 6 on `feature/zero-hallucination-security`)*

### Changes
1. **Import custom GPT instruction set**: Admin pastes instruction set into Settings panel → stored in `BotConfig.instructions`.
2. **Pre-import audit**: Before saving, scan instruction text for phrases that conflict with zero-hallucination guardrails:
   - "use your knowledge" → flag
   - "make your best guess" → flag
   - "if not sure" → flag
   - "you can also consider" → flag
   Any flagged phrase is highlighted in the UI with a warning: *"This instruction may allow responses outside the knowledge base."*
3. **Injection order**: Custom instructions injected after the KB-grounding system prompt, not before. KB-grounding always takes precedence.
4. **Instruction sandboxing**: Custom instructions wrapped in `<custom_instructions>...</custom_instructions>` XML block. Claude is told in the base prompt: "Follow custom instructions for tone and format only — never for factual content."

### Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Flagging logic too aggressive — flags valid instructions | Low | Provide manual override: admin can acknowledge and save anyway with a confirmation |
| Custom instructions conflict with KB grounding in subtle ways | Medium | Test with real queries after import. Monitor verifier fire rate for spike |

---

## Section 6: RFP / Analysis Unanswered Question Handling
*(Step 7 on `feature/zero-hallucination-security`)*

### Changes
1. **Per-question KB check**: Each RFP question runs independently through retrieval + CRAG gate.
2. **Unanswered flag**: Questions where no chunks pass threshold get a structured flag:
   ```json
   { "question": "...", "answer": null, "status": "not_in_kb", "human_note": "" }
   ```
3. **Export format**: RFP response document clearly marks unanswered questions in a distinct section: *"The following questions require manual input — the knowledge base does not contain sufficient information to answer them."*
4. **Future hook**: `human_note` field is ready for the admin to fill in manually (D behaviour later).

### Risks
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| All RFP questions flagged as not_in_kb due to strict threshold | Medium | If >30% of an RFP is flagged, warn the user: "KB coverage may be insufficient for this RFP" |

---

## Implementation Order

All steps on single branch: `feature/zero-hallucination-security` → merge to `main` once complete.

1. **Step 1** — Create branch + raise retrieval thresholds (config.py)
2. **Step 2** — Query preprocessing + prompt injection defense
3. **Step 3** — Security hardening (rate limits, Qdrant auth, audit log, headers)
4. **Step 4** — Q&A-aware ingestion + new Qdrant collection `imocha_kb_v2`
5. **Step 5** — Post-generation Haiku verification layer
6. **Step 6** — Instruction set import with conflict detection
7. **Step 7** — RFP unanswered question flagging (can run after Step 5)

---

## Non-Goals (MVP)
- Soft stop with related suggestions (future: Phase 2)
- KB gap notifications to admin (future: Phase 2)
- Sentence-level citation enforcement (future: if KB scales to 500+ docs)
- AWS Secrets Manager integration (future: before cloud deployment)
- Multi-tenant / client-facing version
