import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from repo root (two levels up from backend/)
_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_DIR.parent

load_dotenv(_REPO_ROOT / ".env")


# Circle API
CIRCLE_API_KEY: str = os.getenv("CIRCLE_API_KEY", "")
CIRCLE_ENTITY_SECRET: str = os.getenv("CIRCLE_ENTITY_SECRET", "")
CIRCLE_API_BASE: str = "https://api.circle.com/v1/w3s"

# Arc / Chain
ARC_TESTNET_RPC_URL: str = os.getenv("ARC_TESTNET_RPC_URL", "https://arc-testnet.drpc.org")
USDC_ADDRESS: str = os.getenv("USDC_ADDRESS", "0x3600000000000000000000000000000000000000")
GATEWAY_API_BASE: str = "https://gateway-api-testnet.circle.com/v1"
GATEWAY_WALLET_ADDRESS: str = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"
GATEWAY_API_BASE: str = "https://gateway-api-testnet.circle.com/v1"
GATEWAY_WALLET_ADDRESS: str = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"

# Chain ID for Arc testnet — needed for EIP-3009 domain separator
ARC_CHAIN_ID: int = int(os.getenv("ARC_CHAIN_ID", "2342"))


# LLM
NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")

# Which LLM backend to use: "nvidia"
LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "nvidia")
LLM_MODEL: str = os.getenv("LLM_MODEL", "meta/llama-3.1-8b-instruct")


# Seller wallet (receives nanopayment authorizations)

# This is the Circle wallet address for this marketplace (the "seller").
# Set after running wallet.py:setup_seller_wallet() for the first time.
SELLER_WALLET_ADDRESS: str = os.getenv("SELLER_WALLET_ADDRESS", "")
SELLER_WALLET_ID: str = os.getenv("SELLER_WALLET_ID", "")


# Per-agent pricing (in USDC)
AGENT_PRICES: dict[str, float] = {
    "summarizer": float(os.getenv("PRICE_SUMMARIZER", "0.05")),
    "debugger":   float(os.getenv("PRICE_DEBUGGER",   "0.10")),
    "researcher": float(os.getenv("PRICE_RESEARCHER",  "0.08")),
}


# CORS / server
# Comma-separated list of allowed origins for CORS (frontend dev server)
CORS_ORIGINS: list[str] = [
    o.strip()
    for o in os.getenv(
        "CORS_ORIGINS",
        "http://localhost:3000,http://localhost:5173,http://localhost:5500,http://127.0.0.1:5500,http://localhost:8000,http://localhost:8080",
    ).split(",")
    if o.strip()
]