from __future__ import annotations
import logging
import httpx
from typing import Any, Callable, Coroutine

logger = logging.getLogger(__name__)

# Service functions (mock implementations)
async def fetch_twitter(input_data: str) -> str:
    return f"Mock Twitter data for: {input_data}"

async def fetch_youtube(input_data: str) -> str:
    return f"Mock YouTube metadata and transcript for: {input_data}"

async def get_token_price(input_data: str) -> str:
    token_id = input_data.strip().lower()
    if not token_id:
        return "Error: Please provide a token id (e.g. 'bitcoin', 'ethereum')."
        
    url = f"https://api.coingecko.com/api/v3/simple/price?ids={token_id}&vs_currencies=usd"
    
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
            
            if token_id in data and "usd" in data[token_id]:
                price = data[token_id]["usd"]
                return f"{price}"
            else:
                return f"Error: Could not find price for token '{token_id}'"
    except httpx.HTTPError as e:
        logger.error("CoinGecko API error: %s", e)
        return f"Error fetching price for '{token_id}'. Please try again later."

# Service Registry
ServiceFn = Callable[[str], Coroutine[Any, Any, str]]

class ServiceDefinition:
    def __init__(
        self,
        id: str,
        name: str,
        description: str,
        price_usdc: float,
        fn: ServiceFn,
    ) -> None:
        self.id = id
        self.name = name
        self.description = description
        self.price_usdc = price_usdc
        self.fn = fn

SERVICE_REGISTRY: dict[str, ServiceDefinition] = {
    "token_price": ServiceDefinition(
        id="token_price",
        name="📈 Token Price",
        description="Gets the current price for a given cryptocurrency token.",
        price_usdc=0.02,
        fn=get_token_price,
    ),
    "twitter_fetch": ServiceDefinition(
        id="twitter_fetch",
        name="🐦 Twitter Fetch",
        description="Fetches recent tweets for a given keyword or handle.",
        price_usdc=0.05,
        fn=fetch_twitter,
    ),
    "youtube_fetch": ServiceDefinition(
        id="youtube_fetch",
        name="📺 YouTube Fetch",
        description="Fetches metadata and transcript for a YouTube video.",
        price_usdc=0.08,
        fn=fetch_youtube,
    ),
}

async def run_service(service_id: str, input_data: str) -> str:
    if service_id not in SERVICE_REGISTRY:
        raise ValueError(f"Unknown service_id '{service_id}'. Valid IDs: {list(SERVICE_REGISTRY)}")

    service = SERVICE_REGISTRY[service_id]
    logger.info("Running service '%s' | input length: %d chars", service_id, len(input_data))
    result = await service.fn(input_data)
    logger.info("Service '%s' completed successfully.", service_id)
    return result
