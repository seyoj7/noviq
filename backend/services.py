from __future__ import annotations
import logging
import httpx
from typing import Any, Callable, Coroutine
from bs4 import BeautifulSoup
from backend.config import NVIDIA_API_KEY

logger = logging.getLogger(__name__)


class ServiceExecutionError(Exception):
    """Raised when a service fails to produce a valid result.
    
    This signals the caller that the request should NOT be charged,
    as opposed to a successful result string which should be charged.
    """
    pass


# Service functions
async def fetch_twitter(input_data: str) -> str:
    handle = input_data.strip().lstrip('@')
    if not handle:
        raise ServiceExecutionError("Please provide a valid Twitter handle.")
        
    # Using a free public Nitter instance (xcancel.com) that works on Vercel
    url = f"https://xcancel.com/{handle}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url, headers=headers)
            
            # xcancel might return 404 if the user doesn't exist
            if resp.status_code == 404:
                raise ServiceExecutionError(f"User @{handle} not found.")
            resp.raise_for_status()
            
            soup = BeautifulSoup(resp.text, 'html.parser')
            tweets = []
            
            # Find all tweet containers, limit to 5
            for item in soup.find_all('div', class_='tweet-body')[:5]:
                content = item.find('div', class_='tweet-content')
                if content:
                    tweets.append(content.get_text(strip=True))
                    
            if not tweets:
                raise ServiceExecutionError(
                    f"No recent tweets found for @{handle} (or the profile is protected)."
                )
                
            formatted = f"Recent tweets from @{handle}:\n\n"
            for t in tweets:
                formatted += f"{t}\n\n---\n\n"
                
            return formatted.strip("\n- ")
            
    except ServiceExecutionError:
        raise
    except httpx.HTTPError as e:
        logger.error("Scraper error: %s", e)
        raise ServiceExecutionError(
            "Error fetching Twitter data. The public proxy might be down. Try again later."
        )

async def ask_llm(input_data: str) -> str:
    if not NVIDIA_API_KEY:
        raise ServiceExecutionError("NVIDIA_API_KEY is not configured.")
    
    url = "https://integrate.api.nvidia.com/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {NVIDIA_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "nvidia/nemotron-3.5-lightning-30b-a3b",
        "messages": [
            {"role": "user", "content": input_data}
        ],
        "max_tokens": 16384,
        "temperature": 1
    }
    
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"]
    except httpx.HTTPError as e:
        logger.error("LLM API error: %s", e)
        raise ServiceExecutionError(
            "Error communicating with LLM API. Please try again later."
        )

async def get_token_price(input_data: str) -> str:
    token_id = input_data.strip().lower()
    if not token_id:
        raise ServiceExecutionError("Please provide a token id (e.g. 'bitcoin', 'ethereum').")
        
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
                raise ServiceExecutionError(
                    f"Could not find price for token '{token_id}'"
                )
    except ServiceExecutionError:
        raise
    except httpx.HTTPError as e:
        logger.error("CoinGecko API error: %s", e)
        raise ServiceExecutionError(
            f"Error fetching price for '{token_id}'. Please try again later."
        )

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
        price_usdc=0.001,
        fn=get_token_price,
    ),
    "twitter_fetch": ServiceDefinition(
        id="twitter_fetch",
        name="🐦 Twitter Fetch",
        description="Fetches recent tweets for a given keyword or handle.",
        price_usdc=0.05,
        fn=fetch_twitter,
    ),
    "nemotron-3.5": ServiceDefinition(
        id="nemotron-3.5",
        name="🧠 nemotron-3.5",
        description="Fastest 30B A3B MoE model with leading domain accuracy for specialized agentic tasks",
        price_usdc=0.10,
        fn=ask_llm,
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

