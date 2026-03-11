import logging
import re
from dataclasses import dataclass, field
from datetime import date

import tiktoken

from app.core.ingestion.parser import ParsedElement

CHILD_TOKENS = 250
CHILD_OVERLAP = 25
PARENT_TOKENS = 1000   # increased from 700 for denser DOCX paragraphs
QA_TOKEN_CAP = 1200    # max tokens for a single Q&A atomic chunk

_enc = tiktoken.get_encoding("cl100k_base")
_log = logging.getLogger(__name__)


def _tokenize(text: str) -> list[int]:
    return _enc.encode(text)


def _decode(tokens: list[int]) -> str:
    return _enc.decode(tokens)


def _token_count(text: str) -> int:
    return len(_tokenize(text))


def _sliding_window(tokens: list[int], size: int, overlap: int) -> list[list[int]]:
    chunks = []
    step = size - overlap
    for i in range(0, max(1, len(tokens) - overlap), step):
        chunk = tokens[i : i + size]
        if chunk:
            chunks.append(chunk)
        if i + size >= len(tokens):
            break
    return chunks


# ── Q&A pattern detection ────────────────────────────────────────────────────

# Matches: "Q:", "Q.", "Question:", "Question 1:", etc.
_QA_QUESTION_PREFIX = re.compile(
    r"^(?:Q\s*[.:\d]\s*|Question\s*[\d]*\s*[.:])\s*",
    re.IGNORECASE,
)

# Matches: "A:", "A.", "Answer:", "Answer 1:", etc.
_QA_ANSWER_PREFIX = re.compile(
    r"^(?:A\s*[.:\d]\s*|Answer\s*[\d]*\s*[.:])\s*",
    re.IGNORECASE,
)

# Short interrogative headings (Title/Header elements ending in ?)
_QUESTION_HEADING = re.compile(r".+\?$")


def _infer_content_type(el: ParsedElement) -> str:
    if el.element_type in ("ListItem", "List"):
        return "list"
    if el.element_type == "Table":
        return "table"
    return "prose"


def _detect_qa_pairs(
    els: list[ParsedElement],
) -> list[tuple[str, str]]:
    """
    Scan elements for Q&A pairs. Returns list of (combined_text, content_type).

    Detects:
    1. Elements starting with Q:/Question: followed by A:/Answer: in adjacent elements
    2. Title/Header elements ending in '?' followed by NarrativeText (answer)
    3. Single elements containing both a Q: and A: marker in the same text block

    Fallback: returns element as prose/list/table.
    """
    result: list[tuple[str, str]] = []
    i = 0
    while i < len(els):
        el = els[i]
        text = el.text.strip()
        if not text:
            i += 1
            continue

        # --- Pattern 1: explicit Q: prefix ---
        if _QA_QUESTION_PREFIX.match(text):
            qa_parts = [text]
            j = i + 1
            # Collect up to 5 following elements looking for the A: marker
            while j < len(els) and j < i + 6:
                next_text = els[j].text.strip()
                if not next_text:
                    j += 1
                    continue
                if _QA_ANSWER_PREFIX.match(next_text):
                    qa_parts.append(next_text)
                    i = j  # advance past the answer element
                    break
                # Stop if we hit another question
                if _QA_QUESTION_PREFIX.match(next_text):
                    break
                # Accumulate as part of the answer block
                qa_parts.append(next_text)
                j += 1
            result.append(("\n".join(qa_parts), "qa_pair"))

        # --- Pattern 2: Title/Header ending in ? (question heading + answer body) ---
        elif el.element_type in ("Title", "Header") and _QUESTION_HEADING.match(text):
            qa_parts = [text]
            j = i + 1
            while j < len(els) and j < i + 8:
                next_el = els[j]
                # Stop at next heading
                if next_el.element_type in ("Title", "Header"):
                    break
                if next_el.text.strip():
                    qa_parts.append(next_el.text.strip())
                j += 1
            i = j - 1  # skip consumed answer elements
            result.append(("\n".join(qa_parts), "qa_pair"))

        # --- Pattern 3: single element containing inline Q:/A: --------
        elif _QA_QUESTION_PREFIX.search(text) and _QA_ANSWER_PREFIX.search(text):
            result.append((text, "qa_pair"))

        # --- Fallback: prose/list/table ---
        else:
            result.append((text, _infer_content_type(el)))

        i += 1

    return result


# ── ChunkPayload ─────────────────────────────────────────────────────────────

@dataclass
class ChunkPayload:
    doc_id: str
    doc_name: str
    doc_type: str
    category: str
    section: str
    page_number: int | None
    chunk_index: int
    child_text: str
    parent_text: str
    date_ingested: str
    content_type: str = "prose"   # qa_pair | prose | list | table


# ── Main chunker ─────────────────────────────────────────────────────────────

def chunk_elements(
    elements: list[ParsedElement],
    doc_name: str,
    doc_type: str,
    category: str,
) -> list[ChunkPayload]:
    """
    Parent-Document Retriever with Q&A-aware chunking:

    - Q&A pairs: kept as atomic units (question + answer never split).
      child_text = full pair (capped at CHILD_TOKENS for embedding).
      parent_text = full pair (capped at QA_TOKEN_CAP for LLM context).

    - Prose/lists/tables: sliding window within section boundary.
      Child: CHILD_TOKENS with CHILD_OVERLAP.
      Parent: PARENT_TOKENS.

    All chunks are section-bounded — no chunk crosses a section heading.
    """
    if not elements:
        return []

    # Group elements by section, preserving order
    section_groups: dict[str, list[ParsedElement]] = {}
    for el in elements:
        section_groups.setdefault(el.section, []).append(el)

    chunks: list[ChunkPayload] = []
    chunk_index = 0

    for section, els in section_groups.items():
        page_number = next((el.page_number for el in els if el.page_number), None)
        doc_id = els[0].doc_id

        detected = _detect_qa_pairs(els)

        for combined_text, content_type in detected:
            combined_text = combined_text.strip()
            if not combined_text:
                continue

            if content_type == "qa_pair":
                # --- Atomic Q&A chunk ---
                tokens = _tokenize(combined_text)
                if len(tokens) > QA_TOKEN_CAP:
                    _log.warning(
                        "Q&A pair exceeds token cap (%d tokens) in doc '%s' section '%s'. "
                        "Consider restructuring the source document.",
                        len(tokens), doc_name, section,
                    )
                    tokens = tokens[:QA_TOKEN_CAP]

                full_text = _decode(tokens)
                # child_text: first CHILD_TOKENS for embedding
                child_tokens = tokens[:CHILD_TOKENS]
                child_text = _decode(child_tokens)

                chunks.append(
                    ChunkPayload(
                        doc_id=doc_id,
                        doc_name=doc_name,
                        doc_type=doc_type,
                        category=category,
                        section=section,
                        page_number=page_number,
                        chunk_index=chunk_index,
                        child_text=child_text,
                        parent_text=full_text,
                        date_ingested=date.today().isoformat(),
                        content_type="qa_pair",
                    )
                )
                chunk_index += 1

            else:
                # --- Sliding window for prose/list/table ---
                all_tokens = _tokenize(combined_text)
                if not all_tokens:
                    continue

                parent_windows = _sliding_window(all_tokens, PARENT_TOKENS, 0)
                for parent_tokens in parent_windows:
                    parent_text = _decode(parent_tokens)
                    child_windows = _sliding_window(parent_tokens, CHILD_TOKENS, CHILD_OVERLAP)
                    for child_tokens in child_windows:
                        child_text = _decode(child_tokens)
                        chunks.append(
                            ChunkPayload(
                                doc_id=doc_id,
                                doc_name=doc_name,
                                doc_type=doc_type,
                                category=category,
                                section=section,
                                page_number=page_number,
                                chunk_index=chunk_index,
                                child_text=child_text,
                                parent_text=parent_text,
                                date_ingested=date.today().isoformat(),
                                content_type=content_type,
                            )
                        )
                        chunk_index += 1

    return chunks
