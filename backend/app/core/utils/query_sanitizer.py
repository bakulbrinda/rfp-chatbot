"""
Query sanitizer — strips prompt injection patterns and enforces input constraints.

Two responsibilities:
  sanitize_query(text) → cleaned text safe for retrieval and generation
  wrap_query(text)     → wraps cleaned text in XML delimiter for prompt injection defense
"""

import re
import unicodedata

# Maximum allowed query length in characters
MAX_QUERY_LENGTH = 2000

# Injection patterns — ordered from most to least specific.
# Only match clear attempts to override instructions; conservative to avoid
# false positives on legitimate sales queries.
_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?|context)", re.I),
    re.compile(r"disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?)", re.I),
    re.compile(r"forget\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?|context)", re.I),
    re.compile(r"you\s+are\s+now\s+(a\s+|an\s+)?(?!imocha|maya)", re.I),
    re.compile(r"pretend\s+(you\s+are|to\s+be)\s+(a\s+|an\s+)?", re.I),
    re.compile(r"act\s+as\s+(a\s+|an\s+)?(?!imocha|maya)", re.I),
    re.compile(r"new\s+(system\s+)?prompt\s*:", re.I),
    re.compile(r"override\s+(the\s+)?(system|instructions?|rules?)", re.I),
    re.compile(r"(your|the)\s+system\s+prompt\s+is\s+now", re.I),
    re.compile(r"(do\s+not|don't|stop)\s+follow(ing)?\s+(your\s+)?(previous\s+)?(instructions?|rules?)", re.I),
    re.compile(r"reveal\s+(your\s+)?(system\s+prompt|instructions?|rules?)", re.I),
    re.compile(r"print\s+(your\s+)?(system\s+prompt|instructions?)", re.I),
    re.compile(r"</?(system|instruction|prompt)\s*>", re.I),
]


def sanitize_query(text: str) -> str:
    """
    Clean user input before it enters retrieval or generation.

    Steps:
    1. Truncate to MAX_QUERY_LENGTH
    2. Strip control characters (keep newlines and tabs — valid in multi-line RFP input)
    3. Remove prompt injection patterns
    4. Collapse excessive whitespace

    Returns the cleaned string. If the entire input is stripped (only injections),
    returns an empty string — callers should treat this as invalid input.
    """
    if not text:
        return ""

    # 1. Truncate
    text = text[:MAX_QUERY_LENGTH]

    # 2. Strip control characters except \n and \t
    cleaned_chars = []
    for ch in text:
        cat = unicodedata.category(ch)
        if ch in ("\n", "\t"):
            cleaned_chars.append(ch)
        elif cat.startswith("C"):
            # Control / format / surrogate / private-use — strip
            continue
        else:
            cleaned_chars.append(ch)
    text = "".join(cleaned_chars)

    # 3. Strip injection patterns (replace with a space to avoid word merging)
    for pattern in _INJECTION_PATTERNS:
        text = pattern.sub(" ", text)

    # 4. Collapse excessive whitespace (preserve single newlines for RFP text)
    text = re.sub(r"[ \t]{2,}", " ", text)   # multiple spaces/tabs → single space
    text = re.sub(r"\n{3,}", "\n\n", text)    # more than 2 newlines → 2
    text = text.strip()

    return text


def wrap_query(text: str) -> str:
    """
    Wrap cleaned query in an XML delimiter so it cannot be interpreted as
    an instruction by the LLM, even if a pattern slips through sanitization.
    """
    return f"<user_query>{text}</user_query>"
