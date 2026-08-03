import os
from pathlib import Path
from dotenv import load_dotenv

# Load .env from repo root (two levels up from backend/)
_BACKEND_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _BACKEND_DIR.parent

load_dotenv(_REPO_ROOT / ".env")


# Database
POSTGRES_URL: str = os.getenv("DATABASE_URL", "")

# Circle API
CIRCLE_API_KEY: str = os.getenv("CIRCLE_API_KEY", "")
CIRCLE_ENTITY_SECRET: str = os.getenv("CIRCLE_ENTITY_SECRET", "")
CIRCLE_API_BASE: str = "https://api.circle.com/v1/w3s"

# Arc / Chain
ARC_TESTNET_RPC_URL: str = os.getenv("ARC_TESTNET_RPC_URL", "https://arc-testnet.drpc.org")
USDC_ADDRESS: str = os.getenv("USDC_ADDRESS", "0x3600000000000000000000000000000000000000")
GATEWAY_API_BASE: str = "https://gateway-api-testnet.circle.com/v1"
GATEWAY_WALLET_ADDRESS: str = "0x0077777d7EBA4688BDeF3E311b846F25870A19B9"

# Chain ID for Arc testnet — needed for EIP-3009 domain separator
ARC_CHAIN_ID: int = int(os.getenv("ARC_CHAIN_ID", "201980"))


# Seller wallet (receives nanopayment authorizations)

# This is the Circle wallet address for this marketplace (the "seller").
# Set after running wallet.py:setup_seller_wallet() for the first time.
SELLER_WALLET_ADDRESS: str = os.getenv("SELLER_WALLET_ADDRESS", "")
SELLER_WALLET_ID: str = os.getenv("SELLER_WALLET_ID", "")

# LLM Keys
NVIDIA_API_KEY: str = os.getenv("NVIDIA_API_KEY", "")

# No Twitter API keys needed - using free public instances