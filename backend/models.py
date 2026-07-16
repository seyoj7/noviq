from __future__ import annotations
from typing import Literal, Optional
from pydantic import BaseModel, Field


# Agent catalogue
class AgentInfo(BaseModel):

    agent_id: str
    name: str
    description: str
    price_usdc: float = Field(..., description="Cost per request in USDC")
    example_input: str


# /run-agent
class RunAgentRequest(BaseModel):

    agent_id: str = Field(..., description="ID of the agent to run (e.g. 'summarizer')")
    input_text: str = Field(..., min_length=1, description="User-supplied text / query")
    user_id: Optional[str] = Field(
        None,
        description="Caller's user ID — used to look up their Circle wallet for balance display",
    )


class RunAgentResponse(BaseModel):

    agent_id: str
    result: str
    payment_ref: Optional[str] = Field(
        None,
        description="Circle authorization reference returned after signature verification",
    )
    authorization_status: Literal["verified"] = "verified"


# 402 Payment Required
class PaymentChallenge(BaseModel):

    scheme: Literal["x402"] = "x402"
    price_usdc: float
    price_usdc_atomic: int = Field(
        ..., description="Price expressed in USDC's smallest unit (6 decimals)"
    )
    token_address: str = Field(..., description="USDC contract address on Arc testnet")
    seller_address: str = Field(..., description="Marketplace wallet that receives the payment")
    chain_id: int
    agent_id: str
    description: str


# Wallets
class WalletInfo(BaseModel):

    wallet_id: str
    address: str
    usdc_balance: float = 0.0
    user_id: str


class CreateWalletRequest(BaseModel):
    user_id: str = Field(..., description="Stable, unique identifier for the user (e.g. session ID)")


# Health
class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    circle_api_key_set: bool
    entity_secret_set: bool
    nvidia_key_set: bool
    seller_wallet_configured: bool