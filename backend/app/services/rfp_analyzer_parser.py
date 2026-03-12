"""
RFP document parser — converts uploaded PDF/DOCX to structured text
for submission to the Claude analysis pipeline.

Unlike the KB chunker (which splits for vector indexing), this parser
returns a single text block preserving section structure. Claude handles
logical segmentation during requirements extraction.
"""
import io
import structlog
from dataclasses import dataclass

logger = structlog.get_logger()

SUPPORTED_TYPES = {"pdf", "docx"}
MAX_TEXT_CHARS = 150_000  # ~37,500 tokens; well within Claude's 200k context


@dataclass
class ParsedRFPDocument:
    text: str           # Full document text, section boundaries marked with \n\n---\n\n
    page_count: int     # Estimated page count (for validation logging)
    char_count: int     # Character count of extracted text


def parse_rfp_document(file_bytes: bytes, file_type: str) -> ParsedRFPDocument:
    """
    Parse a PDF or DOCX file and return its text content.

    Args:
        file_bytes: Raw file bytes from the upload.
        file_type:  'pdf' or 'docx' (lowercase, no dot).

    Returns:
        ParsedRFPDocument with full text content.

    Raises:
        ValueError: If file_type is unsupported or parsing fails completely.
    """
    if file_type not in SUPPORTED_TYPES:
        raise ValueError(f"Unsupported file type '{file_type}'. Supported: {SUPPORTED_TYPES}")

    try:
        if file_type == "pdf":
            text, pages = _parse_pdf(file_bytes)
        else:
            text, pages = _parse_docx(file_bytes)
    except Exception as exc:
        logger.error("rfp_parse_failed", file_type=file_type, error=str(exc))
        raise ValueError(f"Failed to parse {file_type.upper()} document: {exc}") from exc

    # Truncate if document is extremely large
    if len(text) > MAX_TEXT_CHARS:
        logger.warning("rfp_document_truncated", original_chars=len(text), truncated_to=MAX_TEXT_CHARS)
        text = text[:MAX_TEXT_CHARS] + "\n\n[Document truncated at processing limit]"

    return ParsedRFPDocument(text=text, page_count=pages, char_count=len(text))


def _parse_pdf(file_bytes: bytes) -> tuple[str, int]:
    """Extract text from PDF using unstructured.io."""
    from unstructured.partition.pdf import partition_pdf  # type: ignore

    elements = partition_pdf(file=io.BytesIO(file_bytes), strategy="fast")
    return _elements_to_text(elements)


def _parse_docx(file_bytes: bytes) -> tuple[str, int]:
    """Extract text from DOCX using unstructured.io."""
    from unstructured.partition.docx import partition_docx  # type: ignore

    elements = partition_docx(file=io.BytesIO(file_bytes))
    return _elements_to_text(elements)


def _elements_to_text(elements: list) -> tuple[str, int]:
    """
    Convert unstructured elements into a single text string.
    Section headings are preserved as separators to help Claude identify source_section.
    Returns (text, estimated_page_count).
    """
    from unstructured.documents.elements import Title, Table  # type: ignore

    sections: list[str] = []
    current_section: list[str] = []
    page_numbers: set[int] = set()

    for el in elements:
        # Track page numbers for page count estimate
        if hasattr(el, "metadata") and el.metadata:
            pg = getattr(el.metadata, "page_number", None)
            if pg:
                page_numbers.add(pg)

        el_text = str(el).strip()
        if not el_text:
            continue

        if isinstance(el, Title):
            # Flush current section and start new one
            if current_section:
                sections.append("\n".join(current_section))
                current_section = []
            current_section.append(f"## {el_text}")
        elif isinstance(el, Table):
            current_section.append(f"[TABLE]\n{el_text}\n[/TABLE]")
        else:
            current_section.append(el_text)

    if current_section:
        sections.append("\n".join(current_section))

    full_text = "\n\n---\n\n".join(sections)
    estimated_pages = max(page_numbers) if page_numbers else max(1, len(full_text) // 3000)

    return full_text, estimated_pages
