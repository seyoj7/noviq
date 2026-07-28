from __future__ import annotations
import logging
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

# Ensure the project root is on sys.path so `from backend import ...` works
# regardless of how this file is invoked (python backend/main.py, uvicorn, etc.)
_PROJECT_ROOT = str(Path(__file__).resolve().parent.parent)
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)

import httpx
from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from backend import payment, wallet
from backend import services as service_module
from backend.config import (
    CIRCLE_API_KEY,
    CIRCLE_ENTITY_SECRET,
    SELLER_WALLET_ADDRESS,
)
from backend.models import (
    CreateWalletRequest,
    HealthResponse,
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
app = FastAPI(
    title="Noviq — AI Services Marketplace",
    description=(
        "Pay-per-request AI services powered by Circle Nanopayments on Arc. "
        "No subscriptions. No gas. Just sign and run."
    ),
    version="0.1.0",
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

_FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"


# Routes
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


@app.post("/run-service", tags=["Services"], response_model=None)
async def run_service(
    body: RunServiceRequest,
    x_payment_authorization: str | None = Header(default=None),
):

    if body.service_id not in service_module.SERVICE_REGISTRY:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown service_id '{body.service_id}'. "
                   f"Valid options: {list(service_module.SERVICE_REGISTRY)}",
        )

    service_def = service_module.SERVICE_REGISTRY[body.service_id]

    payment_result = await handle_payment_flow(
        x_payment_authorization=x_payment_authorization,
        item_id=body.service_id,
        price_usdc=service_def.price_usdc,
        description=f"Run {service_def.name} on Noviq",
        user_id=body.user_id,
    )
    
    if isinstance(payment_result, JSONResponse):
        return payment_result
        
    payment_ref = payment_result

    try:
        result = await service_module.run_service(body.service_id, body.input_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        logger.error("Service error: %s", exc)
        raise HTTPException(status_code=502, detail="Service returned an error.")

    return {
        "service_id": body.service_id,
        "result": result,
        "payment_ref": payment_ref,
        "authorization_status": "verified"
    }


# In-memory transaction log (MVP — swap for a DB in production)
_TX_LOG: dict[str, list[dict]] = defaultdict(list)


@app.post("/run", tags=["Services"], response_model=None)
async def run_simple(body: RunServiceRequest):
    """Simple one-call endpoint: handles wallet, payment, and service execution internally."""

    if not body.user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")

    if body.service_id not in service_module.SERVICE_REGISTRY:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown service_id '{body.service_id}'. "
                   f"Valid options: {list(service_module.SERVICE_REGISTRY)}",
        )

    service_def = service_module.SERVICE_REGISTRY[body.service_id]

    # Execute payment directly (wallet lookup + on-chain transfer)
    try:
        payment_ref = await payment.execute_payment(body.user_id, service_def.price_usdc)
    except ValueError as exc:
        raise HTTPException(status_code=402, detail=str(exc))

    # Run the service
    try:
        result = await service_module.run_service(body.service_id, body.input_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    # Log transaction
    _TX_LOG[body.user_id].insert(0, {
        "agent": service_def.name,
        "agentId": body.service_id,
        "cost": service_def.price_usdc,
        "status": "verified",
        "txHash": payment_ref,
        "time": datetime.now(timezone.utc).isoformat(),
    })

    return {
        "service_id": body.service_id,
        "result": result,
        "price_usdc": service_def.price_usdc,
        "payment_ref": payment_ref,
    }


@app.get("/transactions/{user_id}", tags=["Services"])
async def get_transactions(user_id: str):
    """Returns transaction history for a user (from /run calls)."""
    return _TX_LOG.get(user_id, [])



@app.post("/wallet", response_model=WalletInfo, tags=["Wallets"])
async def create_or_get_wallet(body: CreateWalletRequest) -> WalletInfo:
    try:
        return await wallet.get_or_create_wallet(body.user_id)
    except httpx.HTTPStatusError as exc:
        logger.error("Circle Wallets API error: %s", exc)
        raise HTTPException(status_code=502, detail=f"Circle Wallets API error: {exc.response.status_code}")


@app.get("/wallet/{user_id}", response_model=WalletInfo, tags=["Wallets"])
async def get_wallet(user_id: str) -> WalletInfo:
    try:
        return await wallet.get_or_create_wallet(user_id)
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=f"Circle Wallets API error: {exc.response.status_code}")


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

    is_valid, payment_ref = await payment.verify_authorization(
        auth_header=x_payment_authorization,
        expected_amount_usdc=price_usdc,
    )

    if not is_valid:
        raise HTTPException(
            status_code=402,
            detail=f"Payment authorization invalid or insufficient: {payment_ref}",
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




# Serve frontend — GET-only routes so POST API endpoints are not intercepted.
# These must come AFTER all API routes.
@app.get("/", include_in_schema=False)
async def serve_index():
    return FileResponse(str(_FRONTEND_DIR / "index.html"))


@app.get("/{filepath:path}", include_in_schema=False)
async def serve_frontend_files(filepath: str):
    file = _FRONTEND_DIR / filepath
    if file.is_file():
        return FileResponse(str(file))
    # Fallback to index.html for unknown paths (SPA-style)
    return FileResponse(str(_FRONTEND_DIR / "index.html"))


# Direct execution: python backend/main.py
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)