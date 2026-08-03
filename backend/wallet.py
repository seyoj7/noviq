from __future__ import annotations
import logging
import uuid
import base64
import codecs
from Crypto.Cipher import PKCS1_OAEP
from Crypto.Hash import SHA256, keccak
from Crypto.PublicKey import RSA
import httpx

from backend.config import (
    ARC_TESTNET_RPC_URL,
    CIRCLE_API_BASE,
    CIRCLE_API_KEY,
    CIRCLE_ENTITY_SECRET,
    USDC_ADDRESS,
)
from backend.models import WalletInfo

from backend import database

logger = logging.getLogger(__name__)


def to_checksum_address(address: str) -> str:
    """Convert an EVM address to its canonical EIP-55 checksummed format.

    This ensures the same address always has one consistent representation
    (e.g. 0x3b002394D3202B02CE0A9bfD5c0819d6Dd353a56) regardless of input casing.
    """
    addr = address.replace("0x", "").replace("0X", "")
    addr_lower = addr.lower()
    k = keccak.new(digest_bits=256)
    k.update(addr_lower.encode("ascii"))
    hash_hex = k.hexdigest()

    checksummed = "0x"
    for i, c in enumerate(addr_lower):
        if c in "0123456789":
            checksummed += c
        elif int(hash_hex[i], 16) >= 8:
            checksummed += c.upper()
        else:
            checksummed += c
    return checksummed


# Shared HTTP client factory
def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {CIRCLE_API_KEY}",
        "Content-Type": "application/json",
    }


# Wallet CRUD
async def create_wallet(user_id: str) -> WalletInfo:
    if not CIRCLE_API_KEY:
        raise ValueError("CIRCLE_API_KEY is not configured.")

    ciphertext = await _get_entity_secret_ciphertext()
    wallet_set_id = await _get_or_create_wallet_set_id(ciphertext)

    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(
            f"{CIRCLE_API_BASE}/developer/wallets",
            headers=_headers(),
            json={
                "idempotencyKey": str(uuid.uuid5(uuid.NAMESPACE_DNS, f"noviq-arc-{user_id}")),
                "entitySecretCiphertext": ciphertext,
                "walletSetId": wallet_set_id,
                "blockchains": ["ARC-TESTNET"],
                "count": 1,
                "metadata": [{"name": f"user-{user_id}"[:50], "refId": user_id}],
            },
        )
        try:
            resp.raise_for_status()
        except httpx.HTTPStatusError as exc:
            logger.error("Circle Wallet creation failed: %s", exc.response.text)
            raise
        
        data = resp.json()
        wallet_data = data["data"]["wallets"][0]

        return WalletInfo(
            wallet_id=wallet_data["id"],
            address=wallet_data["address"],
            usdc_balance=0.0,
            user_id=user_id,
        )


async def get_wallet_balance(wallet_id: str, user_id: str) -> WalletInfo:
    if not CIRCLE_API_KEY:
        raise ValueError("CIRCLE_API_KEY is not configured.")

    wallet_info = await _get_wallet_info(wallet_id, user_id)

    # Fetch balance directly from the Arc Testnet RPC
    data = "0x70a08231" + wallet_info.address.replace("0x", "").zfill(64)
    async with httpx.AsyncClient(timeout=30.0) as client:
        # Check ERC20 Balance
        resp_erc20 = await client.post(
            ARC_TESTNET_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "method": "eth_call",
                "params": [{"to": USDC_ADDRESS, "data": data}, "latest"],
                "id": 1,
            },
        )
        resp_erc20.raise_for_status()
        erc20_result = resp_erc20.json().get("result", "0x0")
        
        # Check Native Balance
        resp_native = await client.post(
            ARC_TESTNET_RPC_URL,
            json={
                "jsonrpc": "2.0",
                "method": "eth_getBalance",
                "params": [wallet_info.address, "latest"],
                "id": 2,
            },
        )
        resp_native.raise_for_status()
        native_result = resp_native.json().get("result", "0x0")
        
    # USDC has 6 decimals on Circle contracts, but native gas tokens on EVM often have 18 decimals.
    # We will compute both and use the sum (converting native wei if it has 18 decimals, though Circle might use 6 or 18).
    # Since we aren't sure if native is 6 or 18, we will assume 18 for native and 6 for ERC20.
    erc20_usdc = int(erc20_result, 16) / 1_000_000.0
    
    # If native result is extremely large, it's likely 18 decimals. Let's just assume 18 for safety if it's native.
    native_val = int(native_result, 16)
    native_usdc = native_val / 1e18 if native_val > 1e15 else native_val / 1e6
    
    # To avoid double counting on networks where native token and ERC20 are the same underlying asset,
    # we take the max of the two balances.
    wallet_info.usdc_balance = max(erc20_usdc, native_usdc)

    return wallet_info


async def _get_wallet_info(wallet_id: str, user_id: str) -> WalletInfo:
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{CIRCLE_API_BASE}/wallets/{wallet_id}",
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        w = data["data"]["wallet"]
        return WalletInfo(
            wallet_id=w["id"],
            address=w["address"],
            usdc_balance=0.0,
            user_id=user_id,
        )


async def get_or_create_wallet(user_id: str) -> WalletInfo:
    # Normalize to EIP-55 checksum so the same address always has one representation
    user_id = to_checksum_address(user_id)
    wallet_id = database.get_wallet(user_id)
    if wallet_id:
        try:
            return await get_wallet_balance(wallet_id, user_id)
        except httpx.HTTPError as exc:
            logger.error("Failed to fetch balance for wallet %s: %s", wallet_id, exc)
            return WalletInfo(wallet_id=wallet_id, address="unknown", usdc_balance=0.0, user_id=user_id)

    # Query Circle API by refId to see if we already created a wallet for this EVM address
    # This guarantees the address remains the same even if the backend is restarted and _WALLET_STORE is cleared.
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{CIRCLE_API_BASE}/wallets?refId={user_id}&blockchain=ARC-TESTNET",
            headers=_headers()
        )
        if resp.status_code == 200:
            wallets = resp.json().get("data", {}).get("wallets", [])
            if wallets:
                wallet_id = wallets[0]["id"]
                database.save_wallet(user_id, wallet_id)
                return await get_wallet_balance(wallet_id, user_id)

    wallet = await create_wallet(user_id)
    database.save_wallet(user_id, wallet.wallet_id)
    return wallet


async def _get_entity_secret_ciphertext() -> str:
    if not CIRCLE_ENTITY_SECRET:
        return ""
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.get(
            f"{CIRCLE_API_BASE}/config/entity/publicKey",
            headers=_headers(),
        )
        resp.raise_for_status()
        data = resp.json()
        public_key_pem = data["data"]["publicKey"]

    entity_secret_bytes = codecs.decode(CIRCLE_ENTITY_SECRET, "hex")
    rsa_key = RSA.import_key(public_key_pem)
    cipher = PKCS1_OAEP.new(rsa_key, hashAlgo=SHA256, mgfunc=lambda x, y: PKCS1_OAEP.MGF1(x, y, SHA256))
    encrypted = cipher.encrypt(entity_secret_bytes)
    return base64.b64encode(encrypted).decode("utf-8")


async def _get_or_create_wallet_set_id(ciphertext: str) -> str:
    async with httpx.AsyncClient(timeout=30.0) as client:
        r = await client.get(f"{CIRCLE_API_BASE}/walletSets", headers=_headers())
        r.raise_for_status()
        wallet_sets = r.json().get("data", {}).get("walletSets", [])
        if wallet_sets:
            return wallet_sets[0]["id"]
            
        r = await client.post(
            f"{CIRCLE_API_BASE}/developer/walletSets",
            headers=_headers(),
            json={
                "idempotencyKey": str(uuid.uuid4()),
                "entitySecretCiphertext": ciphertext,
                "name": "Marketplace Wallet Set"
            }
        )
        r.raise_for_status()
        return r.json()["data"]["walletSet"]["id"]