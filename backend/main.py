from __future__ import annotations
import logging
import sys
import uuid
from pathlib import Path

# Ensure the project root is on sys.path so `from backend import ...` works
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import httpx
from fastapi import FastAPI, Depends, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from backend import payment, wallet, database
from backend.wallet import to_checksum_address
from backend import services as service_module
from backend.services import ServiceExecutionError
from backend.auth import (
    generate_api_key,
    generate_nonce,
    build_challenge_message,
    validate_api_key,
    optional_validate_api_key,
    verify_wallet_signature,
)
from backend.config import (
    CIRCLE_API_KEY,
    CIRCLE_ENTITY_SECRET,
    SELLER_WALLET_ADDRESS,
)
from backend.models import (
    ApiKeyCreatedResponse,
    ApiKeyResponse,
    CreateWalletRequest,
    GenerateApiKeyRequest,
    HealthResponse,
    NonceResponse,
    RevokeApiKeyRequest,
    RunServiceRequest,
    ServiceInfo,
    WalletInfo,
)


# Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
logging.getLogger("httpx").setLevel(logging.WARNING)


# FastAPI app
database.init_db()
app = FastAPI(
    title="Noviq — AI Services Marketplace",
    description=(
        "Pay-per-request AI services powered by Circle Nanopayments on Arc. "
        "No subscriptions. No gas. Just sign and run."
    ),
    version="0.3.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Consistent error responses ──────────────────────────────────────
# Always include "result" in the JSON body so clients that do
# response.json()["result"] never crash with a KeyError.

@app.exception_handler(HTTPException)
async def unified_http_error(_request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "result": None,
            "error": exc.detail,
            "status_code": exc.status_code,
        },
    )


# ── Public routes (no auth) ─────────────────────────────────────────

@app.get("/health", response_model=HealthResponse, tags=["Meta"])
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        circle_api_key_set=bool(CIRCLE_API_KEY),
        entity_secret_set=bool(CIRCLE_ENTITY_SECRET),
        seller_wallet_configured=bool(SELLER_WALLET_ADDRESS),
    )


@app.get("/services", response_model=list[ServiceInfo], tags=["Services"])
async def list_services() -> list[ServiceInfo]:
    return [
        ServiceInfo(
            id=s.id,
            name=s.name,
            description=s.description,
            price_usdc=s.price_usdc,
        )
        for s in service_module.SERVICE_REGISTRY.values()
    ]


# ── Auth nonce endpoint ─────────────────────────────────────────────

@app.get("/auth/nonce/{wallet_address}", response_model=NonceResponse, tags=["Auth"])
async def get_auth_nonce(wallet_address: str) -> NonceResponse:
    wallet_addr = to_checksum_address(wallet_address)
    nonce = generate_nonce()
    database.save_nonce(wallet_addr, nonce)
    message = build_challenge_message(nonce)
    return NonceResponse(nonce=nonce, message=message, expires_in=300)


# ── Service execution routes (API key required) ─────────────────────

@app.post("/run-service", tags=["Services"], response_model=None)
async def run_service(
    body: RunServiceRequest,
    wallet_address: str = Depends(validate_api_key),
    x_payment_authorization: str | None = Header(default=None),
):
    # Ensure consistent EIP-55 checksummed address across all flows
    wallet_address = to_checksum_address(wallet_address)

    if body.service_id not in service_module.SERVICE_REGISTRY:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown service_id '{body.service_id}'. "
                   f"Valid options: {list(service_module.SERVICE_REGISTRY)}",
        )

    service_def = service_module.SERVICE_REGISTRY[body.service_id]

    # Step 1: Handle x402 payment authorization challenge/verification
    payment_result = await handle_payment_flow(
        x_payment_authorization=x_payment_authorization,
        item_id=body.service_id,
        price_usdc=service_def.price_usdc,
        description=f"Run {service_def.name} on Noviq",
        user_id=wallet_address,
    )

    if isinstance(payment_result, JSONResponse):
        return payment_result

    # Step 2: Balance pre-check (verify user can pay before doing work)
    try:
        await payment.check_balance(wallet_address, service_def.price_usdc)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail=str(exc))

    # Step 3: Create pending request for audit trail
    request_id = str(uuid.uuid4())
    database.create_pending_request(
        request_id=request_id,
        user_id=wallet_address,
        service_id=body.service_id,
        cost=service_def.price_usdc,
    )

    # Step 4: Run the service BEFORE charging
    try:
        result = await service_module.run_service(body.service_id, body.input_data)
    except (ValueError, ServiceExecutionError) as exc:
        database.fail_pending_request(request_id, str(exc))
        raise HTTPException(status_code=400, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        database.fail_pending_request(request_id, f"Service upstream error: {exc}")
        logger.error("Service error: %s", exc)
        raise HTTPException(status_code=502, detail="Service returned an error.")
    except Exception as exc:
        database.fail_pending_request(request_id, f"Unexpected error: {exc}")
        logger.error("Unexpected service error: %s", exc)
        raise HTTPException(status_code=500, detail="Internal service error.")

    # Step 5: Service succeeded — now charge the user
    try:
        tx_hash = await payment.execute_payment(wallet_address, service_def.price_usdc)
    except ValueError as exc:
        database.fail_pending_request(request_id, f"Payment failed after service success: {exc}")
        logger.error("Payment failed after service success: %s", exc)
        raise HTTPException(status_code=402, detail=str(exc))

    # Step 6: Record success
    database.complete_pending_request(request_id, tx_hash)
    database.save_transaction(
        user_id=wallet_address,
        service_id=body.service_id,
        service_name=service_def.name,
        cost=service_def.price_usdc,
        status="verified",
        tx_hash=tx_hash,
    )

    return {
        "service_id": body.service_id,
        "result": result,
        "tx_hash": tx_hash,
        "authorization_status": "verified"
    }


@app.post("/run", tags=["Services"], response_model=None)
async def run_simple(
    body: RunServiceRequest,
    wallet_address: str = Depends(validate_api_key),
):
    # Ensure consistent EIP-55 checksummed address across all flows
    wallet_address = to_checksum_address(wallet_address)

    if body.service_id not in service_module.SERVICE_REGISTRY:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown service_id '{body.service_id}'. "
                   f"Valid options: {list(service_module.SERVICE_REGISTRY)}",
        )

    service_def = service_module.SERVICE_REGISTRY[body.service_id]

    # Step 1: Balance pre-check (reject early if user can't pay)
    try:
        await payment.check_balance(wallet_address, service_def.price_usdc)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail=str(exc))

    # Step 2: Create pending request for audit trail
    request_id = str(uuid.uuid4())
    database.create_pending_request(
        request_id=request_id,
        user_id=wallet_address,
        service_id=body.service_id,
        cost=service_def.price_usdc,
    )

    # Step 3: Run the service BEFORE charging
    try:
        result = await service_module.run_service(body.service_id, body.input_data)
    except (ValueError, ServiceExecutionError) as exc:
        database.fail_pending_request(request_id, str(exc))
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:
        database.fail_pending_request(request_id, f"Unexpected error: {exc}")
        logger.error("Unexpected service error: %s", exc)
        raise HTTPException(status_code=500, detail="Internal service error.")

    # Step 4: Service succeeded — now charge the user
    try:
        tx_hash = await payment.execute_payment(wallet_address, service_def.price_usdc)
    except ValueError as exc:
        database.fail_pending_request(request_id, f"Payment failed after service success: {exc}")
        logger.error("Payment failed after service success: %s", exc)
        raise HTTPException(status_code=402, detail=str(exc))

    # Step 5: Record success
    database.complete_pending_request(request_id, tx_hash)
    database.save_transaction(
        user_id=wallet_address,
        service_id=body.service_id,
        service_name=service_def.name,
        cost=service_def.price_usdc,
        status="verified",
        tx_hash=tx_hash,
    )

    return {
        "service_id": body.service_id,
        "result": result,
        "price_usdc": service_def.price_usdc,
        "tx_hash": tx_hash,
    }


@app.get("/transactions/{user_id}", tags=["Services"])
async def get_user_transactions(
    user_id: str,
):
    target = to_checksum_address(user_id)
    return database.get_transactions(target)


# ── Wallet routes ───────────────────────────────────────────────────

@app.post("/wallet", response_model=WalletInfo, tags=["Wallets"])
async def create_or_get_wallet(body: CreateWalletRequest) -> WalletInfo:
    try:
        return await wallet.get_or_create_wallet(to_checksum_address(body.user_id))
    except httpx.HTTPStatusError as exc:
        logger.error("Circle Wallets API error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Circle Wallets API error: {exc.response.status_code}")


@app.get("/wallet/{user_id}", response_model=WalletInfo, tags=["Wallets"])
async def get_wallet(
    user_id: str,
    api_key_wallet: str = Depends(validate_api_key),
) -> WalletInfo:
    target = to_checksum_address(user_id)
    owner = to_checksum_address(api_key_wallet)

    if target != owner:
        raise HTTPException(
            status_code=403,
            detail="You can only view your own wallet.",
        )

    try:
        return await wallet.get_or_create_wallet(target)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Circle Wallets API error: {exc.response.status_code}")


# ── API Key management routes ───────────────────────────────────────

@app.post("/api-keys", response_model=ApiKeyCreatedResponse, tags=["API Keys"])
async def create_api_key(body: GenerateApiKeyRequest):
    wallet_addr = to_checksum_address(body.wallet_address)

    if not body.label or not body.label.strip():
        raise HTTPException(status_code=400, detail="A key label is required.")

    # Verify wallet ownership via signature
    verify_wallet_signature(wallet_addr, body.signature, body.nonce)

    # Enforce per-wallet limit of 2 active keys
    existing = database.get_api_keys_for_wallet(wallet_addr)
    active_count = sum(1 for k in existing if not k.get("is_revoked"))
    if active_count >= 2:
        raise HTTPException(
            status_code=409,
            detail="Maximum of 2 active API keys per wallet. Revoke an existing key first.",
        )

    raw_key, key_hash, key_prefix = generate_api_key()

    database.save_api_key(
        key_hash=key_hash,
        key_prefix=key_prefix,
        wallet_address=wallet_addr,
        label=body.label,
    )

    from datetime import datetime, timezone
    now = datetime.now(timezone.utc).isoformat()

    return ApiKeyCreatedResponse(
        api_key=raw_key,
        key_prefix=key_prefix,
        label=body.label,
        created_at=now,
    )


@app.get("/api-keys/{wallet_address}", response_model=list[ApiKeyResponse], tags=["API Keys"])
async def list_api_keys(wallet_address: str):
    wallet_addr = to_checksum_address(wallet_address)
    keys = database.get_api_keys_for_wallet(wallet_addr)
    return [ApiKeyResponse(**k) for k in keys]


@app.delete("/api-keys/{key_prefix}", tags=["API Keys"])
async def revoke_api_key_endpoint(
    key_prefix: str,
    body: RevokeApiKeyRequest,
    api_key_wallet: str | None = Depends(optional_validate_api_key),
):
    wallet_addr = to_checksum_address(body.wallet_address)

    # Auth method 1: valid API key for the same wallet
    if api_key_wallet is not None:
        if to_checksum_address(api_key_wallet) != wallet_addr:
            raise HTTPException(
                status_code=403,
                detail="API key does not belong to the wallet that owns this key.",
            )
    # Auth method 2: wallet signature
    elif body.signature and body.nonce:
        verify_wallet_signature(wallet_addr, body.signature, body.nonce)
    else:
        raise HTTPException(
            status_code=401,
            detail="Authentication required. Provide either an API key in the Authorization header "
                   "or a wallet signature (signature + nonce) in the request body.",
        )

    revoked = database.revoke_api_key(key_prefix, wallet_addr)
    if not revoked:
        raise HTTPException(status_code=404, detail="API key not found or already revoked.")
    return {"status": "revoked", "key_prefix": key_prefix}


# ── Payment helper ──────────────────────────────────────────────────

async def handle_payment_flow(
    x_payment_authorization: str | None,
    item_id: str,
    price_usdc: float,
    description: str,
    user_id: str | None,
) -> str | JSONResponse:
    # Step 1: No payment header → issue 402 challenge
    if not x_payment_authorization:
        challenge = payment.build_payment_challenge(
            agent_id=item_id,
            price_usdc=price_usdc,
            description=description,
        )
        return JSONResponse(
            status_code=402,
            content=challenge.model_dump(),
            headers={
                "X-Payment-Scheme": "x402",
                "X-Payment-Price-USDC": str(price_usdc),
            },
        )

    # Step 2: Auth header present → verify via Circle Nanopayments
    logger.info(
        "Received payment authorization for '%s' (price: $%s USDC)",
        item_id,
        price_usdc,
    )

    is_valid, tx_hash = await payment.verify_authorization(
        auth_header=x_payment_authorization,
        expected_amount_usdc=price_usdc,
    )

    if not is_valid:
        raise HTTPException(
            status_code=402,
            detail=f"Payment authorization invalid or insufficient: {tx_hash}",
        )
        
    # Execute the actual on-chain transfer
    if not user_id:
        raise HTTPException(
            status_code=400, 
            detail="Wallet not connected. Cannot execute payment without user_id."
        )
        
    try:
        payment_tx_id = await payment.execute_payment(user_id, price_usdc)
        return payment_tx_id
    except ValueError as exc:
        raise HTTPException(
            status_code=402,
            detail=str(exc),
        )