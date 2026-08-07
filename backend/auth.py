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
    raw = "nvq_" + secrets.token_hex(24)          # 48 hex chars
    key_hash = hash_api_key(raw)
    key_prefix = raw[:12]                          # "nvq_" + 8 hex
    return raw, key_hash, key_prefix


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


def generate_nonce() -> str:
    return secrets.token_hex(16)


def build_challenge_message(nonce: str) -> str:
    return f"{CHALLENGE_PREFIX}{nonce}"


# ── FastAPI dependency ───────────────────────────────────────────────

async def validate_api_key(
    authorization: str | None = Header(default=None),
) -> str:
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="Missing Authorization header. Provide your API key.",
        )

    # Allow both 'Bearer nvq_...' and just 'nvq_...'
    if authorization.lower().startswith("bearer "):
        raw_key = authorization.split(" ", 1)[1]
    else:
        raw_key = authorization.strip()
    if not raw_key.startswith("nvq_"):
        raise HTTPException(
            status_code=401,
            detail="Invalid API key format. Keys must start with 'nvq_'.",
        )

    key_hash = hash_api_key(raw_key)
    key_record = database.get_api_key(key_hash)

    if key_record is None:
        raise HTTPException(status_code=401, detail="Invalid or revoked API key.")

    # Enforce Rate Limiting (60 requests per minute)
    if not database.check_rate_limit(key_hash, limit=60, window_seconds=60):
        raise HTTPException(status_code=429, detail="Rate limit exceeded. Maximum 60 requests per minute allowed.")

    # Update last-used timestamp (fire-and-forget; failure is non-critical)
    try:
        database.update_api_key_last_used(key_hash)
    except Exception:
        logger.debug("Failed to update last_used_at for key %s…", raw_key[:12])

    return key_record["wallet_address"]


async def optional_validate_api_key(
    authorization: str | None = Header(default=None),
) -> str | None:
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

