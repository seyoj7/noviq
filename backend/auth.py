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

# Nonce challenge message prefix — must match what the frontend signs.
CHALLENGE_PREFIX = "Noviq: Verify wallet ownership\nNonce: "


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


def generate_nonce() -> str:
    """Return a random 32-char hex string for use as a one-time nonce."""
    return secrets.token_hex(16)


def build_challenge_message(nonce: str) -> str:
    """Build the human-readable message the wallet must sign."""
    return f"{CHALLENGE_PREFIX}{nonce}"


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


async def optional_validate_api_key(
    authorization: str | None = Header(default=None),
) -> str | None:
    """Like ``validate_api_key`` but returns ``None`` instead of raising
    when no Authorization header is present.  Used for endpoints that
    accept *either* API key auth or signature auth.
    """
    if not authorization:
        return None
    try:
        return await validate_api_key(authorization)
    except HTTPException:
        return None


# ── Wallet signature verification ────────────────────────────────────

def verify_wallet_signature(
    wallet_address: str,
    signature: str,
    nonce: str,
) -> bool:
    """Verify an EIP-191 ``personal_sign`` signature proves ownership of
    *wallet_address*.

    1. Look up the nonce in the database (must be unconsumed, <5 min old).
    2. Reconstruct the challenge message.
    3. Recover the signer using ``eth_account``.
    4. Compare to the claimed address (checksummed).
    5. Consume the nonce on success.

    Raises ``HTTPException(401)`` on any failure.
    """
    from eth_account.messages import encode_defunct
    from eth_account import Account

    from backend.wallet import to_checksum_address

    wallet_addr = to_checksum_address(wallet_address)

    # 1. Validate the nonce
    nonce_record = database.get_nonce(nonce, wallet_addr)
    if nonce_record is None:
        raise HTTPException(
            status_code=401,
            detail="Invalid, expired, or already-used nonce. Request a new one from GET /auth/nonce/{wallet_address}.",
        )

    # 2. Reconstruct the challenge message
    message_text = build_challenge_message(nonce)
    message = encode_defunct(text=message_text)

    # 3. Recover the signer address from the signature
    try:
        recovered = Account.recover_message(message, signature=signature)
    except Exception as exc:
        logger.warning("Signature recovery failed: %s", exc)
        raise HTTPException(
            status_code=401,
            detail="Invalid signature. Could not recover signer address.",
        )

    # 4. Compare (case-insensitive checksum)
    recovered_checksum = to_checksum_address(recovered)
    if recovered_checksum != wallet_addr:
        raise HTTPException(
            status_code=401,
            detail=f"Signature does not match wallet address. "
                   f"Expected {wallet_addr}, recovered {recovered_checksum}.",
        )

    # 5. Consume the nonce
    database.consume_nonce(nonce)
    return True

