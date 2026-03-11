import re
from dataclasses import dataclass
from pathlib import Path


@dataclass
class ParsedElement:
    text: str
    element_type: str
    section: str
    page_number: int | None
    doc_id: str


def _clean(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def parse_document(file_path: str, doc_id: str) -> list[ParsedElement]:
    """
    Parse a PDF, DOCX, or TXT file using unstructured.io.
    Returns a list of ParsedElement with section context.
    """
    try:
        from unstructured.partition.auto import partition

        elements = partition(filename=file_path)
    except Exception as exc:
        # Fallback: plain text read
        return _fallback_parse(file_path, doc_id)

    parsed: list[ParsedElement] = []
    current_section = "Introduction"

    for el in elements:
        el_type = type(el).__name__
        text = _clean(str(el))
        if not text:
            continue

        # Update section from headings / titles
        if el_type in ("Title", "Header", "NarrativeText") and len(text) < 100:
            if el_type in ("Title", "Header"):
                current_section = text

        page_number = None
        if hasattr(el, "metadata") and hasattr(el.metadata, "page_number"):
            page_number = el.metadata.page_number

        parsed.append(
            ParsedElement(
                text=text,
                element_type=el_type,
                section=current_section,
                page_number=page_number,
                doc_id=doc_id,
            )
        )

    return parsed


def _fallback_parse(file_path: str, doc_id: str) -> list[ParsedElement]:
    """Plain-text fallback when unstructured fails."""
    path = Path(file_path)
    try:
        text = path.read_text(encoding="utf-8", errors="ignore")
    except Exception:
        return []

    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
    return [
        ParsedElement(
            text=para,
            element_type="NarrativeText",
            section="Content",
            page_number=None,
            doc_id=doc_id,
        )
        for para in paragraphs
    ]
