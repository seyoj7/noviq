from __future__ import annotations
import logging
import sys
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

from backend import agents as agent_module
from backend import payment, wallet
from backend.config import (
    CIRCLE_API_KEY,
    CIRCLE_ENTITY_SECRET,
    CORS_ORIGINS,
    NVIDIA_API_KEY,
    SELLER_WALLET_ADDRESS,
)
from backend.models import (
    AgentInfo,
    CreateWalletRequest,
    HealthResponse,
    RunAgentRequest,
    RunAgentResponse,
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
    title="Noviq — AI Agent Marketplace",
    description=(
        "Pay-per-request AI agents powered by Circle Nanopayments on Arc. "
        "No subscriptions. No gas. Just sign and run."
    ),
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
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
        nvidia_key_set=bool(NVIDIA_API_KEY),
        seller_wallet_configured=bool(SELLER_WALLET_ADDRESS),
    )


@app.get("/agents", response_model=list[AgentInfo], tags=["Agents"])
async def list_agents() -> list[AgentInfo]:
    return [
        AgentInfo(
            agent_id=a.agent_id,
            name=a.name,
            description=a.description,
            price_usdc=a.price_usdc,
        )
        for a in agent_module.AGENT_REGISTRY.values()
    ]


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


@app.post("/run-agent", tags=["Agents"])
async def run_agent(
    body: RunAgentRequest,
    x_payment_authorization: str | None = Header(default=None),
) -> RunAgentResponse:

    # Validate agent_id up front
    if body.agent_id not in agent_module.AGENT_REGISTRY:
        raise HTTPException(
            status_code=404,
            detail=f"Unknown agent_id '{body.agent_id}'. "
                   f"Valid options: {list(agent_module.AGENT_REGISTRY)}",
        )

    agent_def = agent_module.AGENT_REGISTRY[body.agent_id]

    # Step 1: No payment header → issue 402 challenge
    if not x_payment_authorization:
        challenge = payment.build_payment_challenge(
            agent_id=body.agent_id,
            price_usdc=agent_def.price_usdc,
            description=f"Run {agent_def.name} on Noviq",
        )
        return JSONResponse(
            status_code=402,
            content=challenge.model_dump(),
            headers={
                "X-Payment-Scheme": "x402",
                "X-Payment-Price-USDC": str(agent_def.price_usdc),
            },
        )

    # Step 2: Auth header present → verify via Circle Nanopayments
    logger.info(
        "Received payment authorization for agent '%s' (price: $%s USDC)",
        body.agent_id,
        agent_def.price_usdc,
    )

    is_valid, payment_ref = await payment.verify_authorization(
        auth_header=x_payment_authorization,
        expected_amount_usdc=agent_def.price_usdc,
    )

    if not is_valid:
        raise HTTPException(
            status_code=402,
            detail=f"Payment authorization invalid or insufficient: {payment_ref}",
        )
        
    # Execute the actual on-chain transfer
    if not body.user_id:
        raise HTTPException(
            status_code=400, 
            detail="Wallet not connected. Cannot execute payment without user_id."
        )
        
    try:
        payment_tx_id = await payment.execute_payment(body.user_id, agent_def.price_usdc)
        payment_ref = payment_tx_id
    except ValueError as exc:
        raise HTTPException(
            status_code=402,
            detail=str(exc),
        )

    # Step 3: Payment verified → run the agent
    try:
        result = await agent_module.run_agent(body.agent_id, body.input_text)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except httpx.HTTPStatusError as exc:
        logger.error("LLM API error: %s", exc)
        raise HTTPException(status_code=502, detail="LLM provider returned an error. Try again shortly.")

    authorization_status = "verified"

    logger.info(
        "Agent '%s' completed. payment_ref=%s status=%s",
        body.agent_id,
        payment_ref,
        authorization_status,
    )

    return RunAgentResponse(
        agent_id=body.agent_id,
        result=result,
        payment_ref=payment_ref,
        authorization_status=authorization_status,
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