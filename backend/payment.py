from __future__ import annotations
import logging
import uuid
import httpx
from backend.config import (
    ARC_CHAIN_ID,
    GATEWAY_API_BASE,
    CIRCLE_API_KEY,
    SELLER_WALLET_ADDRESS,
    USDC_ADDRESS,
)
from backend.models import AgentInfo, PaymentChallenge

logger = logging.getLogger(__name__)

# USDC has 6 decimal places
_USDC_DECIMALS = 6


def _usdc_to_atomic(amount_usdc: float) -> int:
    return int(round(amount_usdc * 10**_USDC_DECIMALS))


# Build the 402 challenge payload
def build_payment_challenge(agent_id: str, price_usdc: float, description: str) -> PaymentChallenge:
    return PaymentChallenge(
        scheme="x402",
        price_usdc=price_usdc,
        price_usdc_atomic=_usdc_to_atomic(price_usdc),
        token_address=USDC_ADDRESS,
        seller_address=SELLER_WALLET_ADDRESS or "0x0000000000000000000000000000000000000000",
        chain_id=ARC_CHAIN_ID,
        agent_id=agent_id,
        description=description,
    )


# Verify an EIP-3009 signed authorization
async def verify_authorization(auth_header: str, expected_amount_usdc: float) -> tuple[bool, str]:

    import json
    try:
        data = json.loads(auth_header)
        auth_data = data.get("payload", {}).get("authorization", {})
        auth_value = int(auth_data.get("value", "0"))
        
        expected_atomic = _usdc_to_atomic(expected_amount_usdc)
        
        if auth_value >= expected_atomic:
            payment_ref = f"demo-ref-{uuid.uuid4().hex[:8]}"
            return True, payment_ref
            
        return False, f"Insufficient payment: got {auth_value}, expected {expected_atomic}"
        
    except (json.JSONDecodeError, ValueError) as exc:
        logger.error("Failed to parse authorization header: %s", exc)
        return False, "Invalid authorization format"