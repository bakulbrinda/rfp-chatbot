"""
Validates admin-configured bot instruction sets before they are saved.

Detects phrases that could undermine KB grounding, override hard limits,
or inject adversarial behavior into the system prompt.
"""
import re
from typing import NamedTuple


class ConflictMatch(NamedTuple):
    pattern_name: str
    matched_text: str
    reason: str


# Each entry: (compiled regex, human-readable name, reason for rejection)
_CONFLICT_PATTERNS: list[tuple[re.Pattern, str, str]] = [
    (
        re.compile(
            r"\b(ignore|disregard|forget|override|bypass)\b.{0,40}"
            r"\b(previous|prior|above|all|system|knowledge\s*base|instructions?|rules?|prompt)\b",
            re.IGNORECASE | re.DOTALL,
        ),
        "override_instruction",
        "Attempts to override prior instructions or system rules.",
    ),
    (
        re.compile(
            r"\b(you\s+are\s+now|pretend\s+to\s+be|act\s+as|roleplay\s+as|simulate|impersonate)\b",
            re.IGNORECASE,
        ),
        "role_override",
        "Attempts to redefine the bot's identity or role.",
    ),
    (
        re.compile(
            r"\b(reveal|expose|print|repeat|output|show|display)\b.{0,40}"
            r"\b(system\s*prompt|instructions?|prompt\s*text|hidden\s*text)\b",
            re.IGNORECASE | re.DOTALL,
        ),
        "prompt_leak",
        "Attempts to expose the system prompt or internal instructions.",
    ),
    (
        re.compile(
            r"\b(no\s+limits?|without\s+restrictions?|no\s+restrictions?|unrestricted|remove\s+limits?)\b",
            re.IGNORECASE,
        ),
        "remove_limits",
        "Attempts to remove or circumvent hard limits.",
    ),
    (
        re.compile(
            r"\b(do\s+not\s+use|don'?t\s+use|never\s+use|skip|ignore)\b.{0,30}"
            r"\b(knowledge\s*base|context|documents?|sources?|KB)\b",
            re.IGNORECASE | re.DOTALL,
        ),
        "bypass_kb",
        "Attempts to bypass KB grounding — the bot must always cite its knowledge base.",
    ),
    (
        re.compile(
            r"\b(answer\s+(anything|everything|any\s+question)|respond\s+to\s+all)\b",
            re.IGNORECASE,
        ),
        "unrestricted_scope",
        "Instructs the bot to answer questions outside iMocha's domain, breaking scope limits.",
    ),
    (
        re.compile(
            r"<\s*(script|iframe|object|embed)\b",
            re.IGNORECASE,
        ),
        "html_injection",
        "Contains HTML/script tags — not allowed in instruction text.",
    ),
    (
        re.compile(
            r"\{[^}]{0,200}\}",  # Catches template-like braces that could corrupt the prompt
            re.DOTALL,
        ),
        "template_injection",
        "Contains curly-brace template syntax that may corrupt the system prompt.",
    ),
]

# Absolute length cap for stored instructions
MAX_INSTRUCTION_LENGTH = 4000


def validate_instructions(text: str) -> list[ConflictMatch]:
    """
    Scan instruction text for phrases that conflict with system security rules.

    Returns a list of ConflictMatch entries (empty list = no conflicts found).
    Does NOT raise — callers decide how to handle conflicts.
    """
    if not text or not text.strip():
        return []

    if len(text) > MAX_INSTRUCTION_LENGTH:
        return [
            ConflictMatch(
                pattern_name="too_long",
                matched_text=f"{len(text)} characters",
                reason=f"Instructions exceed {MAX_INSTRUCTION_LENGTH} character limit.",
            )
        ]

    conflicts: list[ConflictMatch] = []
    for pattern, name, reason in _CONFLICT_PATTERNS:
        match = pattern.search(text)
        if match:
            snippet = match.group(0)[:80].replace("\n", " ")
            conflicts.append(ConflictMatch(pattern_name=name, matched_text=snippet, reason=reason))

    return conflicts
