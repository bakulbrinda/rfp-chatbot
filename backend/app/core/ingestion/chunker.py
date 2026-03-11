from dataclasses import dataclass
from datetime import date

import tiktoken

from app.core.ingestion.parser import ParsedElement

CHILD_TOKENS = 250
CHILD_OVERLAP = 25
PARENT_TOKENS = 700

_enc = tiktoken.get_encoding("cl100k_base")


def _tokenize(text: str) -> list[int]:
    return _enc.encode(text)


def _decode(tokens: list[int]) -> str:
    return _enc.decode(tokens)


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


def chunk_elements(
    elements: list[ParsedElement],
    doc_name: str,
    doc_type: str,
    category: str,
) -> list[ChunkPayload]:
    """
    Implement Parent-Document Retriever:
    - Child chunks: 250 tokens, 25-token overlap → stored as vectors
    - Parent chunks: 700 tokens → stored in payload, sent to LLM
    """
    if not elements:
        return []

    # Group elements by section, build full text per section
    section_texts: dict[str, list[ParsedElement]] = {}
    for el in elements:
        section_texts.setdefault(el.section, []).append(el)

    chunks: list[ChunkPayload] = []
    chunk_index = 0

    for section, els in section_texts.items():
        full_text = " ".join(el.text for el in els)
        page_number = next((el.page_number for el in els if el.page_number), None)
        doc_id = els[0].doc_id

        all_tokens = _tokenize(full_text)
        if not all_tokens:
            continue

        # Parent windows
        parent_windows = _sliding_window(all_tokens, PARENT_TOKENS, 0)
        for parent_tokens in parent_windows:
            parent_text = _decode(parent_tokens)

            # Child windows within this parent
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
                    )
                )
                chunk_index += 1

    return chunks
