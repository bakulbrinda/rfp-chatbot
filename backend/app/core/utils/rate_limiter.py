"""
Shared SlowAPI limiter instance.
Defined here to avoid circular imports between main.py and routers.
"""

from slowapi import Limiter

from app.core.auth.tokens import decode_access_token


def _rate_limit_key(request) -> str:  # type: ignore[no-untyped-def]
    """Per-user rate limiting using JWT sub claim; falls back to IP."""
    from slowapi.util import get_remote_address

    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        try:
            payload = decode_access_token(auth[7:])
            return f"user:{payload['sub']}"
        except Exception:
            pass
    return get_remote_address(request)


limiter = Limiter(key_func=_rate_limit_key)
