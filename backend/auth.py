"""
API Key authentication utilities for Noviq.

Keys are formatted as ``nvq_<48 hex chars>`` (24 random bytes).
Only a SHA-256 hash of each key is persisted; the raw key is shown
to the user exactly once at creation time.
"""

from __future__ import annotations

import hashlib
import logging
import secrets

from fastapi import Header, HTTPException

from backend import database

logger = logging.getLogger(__name__)


# ── Key helpers ──────────────────────────────────────────────────────

def generate_api_key() -> tuple[str, str, str]:
    """Return ``(raw_key, key_hash, key_prefix)``."""
    raw = "nvq_" + secrets.token_hex(24)          # 48 hex chars
    key_hash = hash_api_key(raw)
    key_prefix = raw[:12]                          # "nvq_" + 8 hex
    return raw, key_hash, key_prefix


def hash_api_key(raw_key: str) -> str:
    """Deterministic SHA-256 hex digest of *raw_key*."""
    return hashlib.sha256(raw_key.encode()).hexdigest()


# ── FastAPI dependency ───────────────────────────────────────────────

async def validate_api_key(
    authorization: str | None = Header(default=None),
) -> str:
    """Extract and validate the API key from the ``Authorization`` header.

    Returns the wallet address associated with the key.
    Raises **401** if the key is missing, malformed, revoked, or unknown.
    """
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization header. Provide 'Authorization: Bearer nvq_...'",
        )

    parts = authorization.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Authorization header must use 'Bearer <api_key>' format.",
        )

    raw_key = parts[1]
    if not raw_key.startswith("nvq_"):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key format. Keys must start with 'nvq_'.",
        )

    key_hash = hash_api_key(raw_key)
    key_record = database.get_api_key(key_hash)

    if key_record is None:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key.")

    # Update last-used timestamp (fire-and-forget; failure is non-critical)
    try:
        database.update_api_key_last_used(key_hash)
    except Exception:
        logger.debug("Failed to update last_used_at for key %s…", raw_key[:12])

    return key_record["wallet_address"]
