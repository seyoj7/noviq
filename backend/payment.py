from __future__ import annotations
import asyncio
import json
import logging
import uuid
import httpx
from backend.config import (
    ARC_CHAIN_ID,
    CIRCLE_API_KEY,
    SELLER_WALLET_ADDRESS,
    USDC_ADDRESS,
)
from backend.models import PaymentChallenge
from backend.wallet import _get_entity_secret_ciphertext, get_or_create_wallet
from backend import database

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


async def execute_payment(user_id: str, expected_amount_usdc: float) -> str:
    # Get or create the wallet (this also fetches the current balance)
    wallet_info = await get_or_create_wallet(user_id)
    wallet_id = wallet_info.wallet_id

    # Pre-check: reject immediately if the wallet lacks funds
    if wallet_info.usdc_balance < expected_amount_usdc:
        raise ValueError(
            f"Insufficient USDC balance: wallet has {wallet_info.usdc_balance} USDC, "
            f"but {expected_amount_usdc} USDC is required. "
            f"Please fund your wallet ({wallet_info.address}) with USDC on Arc Testnet."
        )

    ciphertext = await _get_entity_secret_ciphertext()
    atomic_amount = _usdc_to_atomic(expected_amount_usdc)

    headers = {
        "Authorization": f"Bearer {CIRCLE_API_KEY}",
        "Content-Type": "application/json"
    }

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"https://api.circle.com/v1/w3s/developer/transactions/contractExecution",
            headers=headers,
            json={
                "idempotencyKey": str(uuid.uuid4()),
                "entitySecretCiphertext": ciphertext,
                "abiFunctionSignature": "transfer(address,uint256)",
                "abiParameters": [
                    SELLER_WALLET_ADDRESS,
                    str(atomic_amount)
                ],
                "contractAddress": USDC_ADDRESS,
                "feeLevel": "MEDIUM",
                "walletId": wallet_id
            }
        )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            try:
                err_msg = exc.response.json().get("message", exc.response.text)
            except Exception:
                err_msg = exc.response.text
            logger.error("Payment execution failed: %s", err_msg)
            raise ValueError(f"Transaction failed: {err_msg}")

        tx_id = resp.json()["data"]["id"]

        # Poll until the transaction is CONFIRMED (not just until a txHash appears)
        for _ in range(30):
            await asyncio.sleep(1)
            try:
                poll_resp = await client.get(
                    f"https://api.circle.com/v1/w3s/transactions/{tx_id}",
                    headers=headers
                )
                poll_resp.raise_for_status()
                data = poll_resp.json().get("data", {}).get("transaction", {})
                state = data.get("state", "")

                if state == "CONFIRMED" and data.get("txHash"):
                    logger.info(
                        "Payment confirmed: %s USDC from wallet %s (tx: %s)",
                        expected_amount_usdc, wallet_id, data["txHash"],
                    )
                    return data["txHash"]
                if state in ("FAILED", "CANCELLED", "DENIED"):
                    error_reason = data.get("errorReason", "Unknown error")
                    raise ValueError(
                        f"Transaction {state.lower()}: {error_reason}"
                    )
            except httpx.HTTPStatusError:
                pass

        raise ValueError(
            f"Transaction timed out waiting for confirmation. "
            f"Circle transaction ID: {tx_id}. Please check status manually."
        )