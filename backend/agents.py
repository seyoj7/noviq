from __future__ import annotations
import logging
from typing import Any, Callable, Coroutine
import httpx

from backend.config import (
    AGENT_PRICES,
    LLM_MODEL,
    LLM_PROVIDER,
    NVIDIA_API_KEY,
)

logger = logging.getLogger(__name__)


# Internal LLM helper
async def _call_llm(system_prompt: str, user_message: str) -> str:

    if LLM_PROVIDER == "nvidia" and NVIDIA_API_KEY:
        return await _call_nvidia(system_prompt, user_message)

    raise ValueError(f"LLM_PROVIDER {LLM_PROVIDER} is not configured correctly.")


async def _call_nvidia(system_prompt: str, user_message: str) -> str:
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(
            "https://integrate.api.nvidia.com/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {NVIDIA_API_KEY}",
                "Content-Type": "application/json",
            },
            json={
                "model": LLM_MODEL,
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_message},
                ],
                "max_tokens": 1024,
                "temperature": 0.4,
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"].strip()


# Agent functions
async def summarize(input_text: str) -> str:
    system_prompt = (
        "You are a summarization assistant. "
        "Given any text, provide a comprehensive summary paragraph. "
        "Do not add any preamble or conclusion."
    )
    return await _call_llm(system_prompt, input_text)


async def debug_code(input_text: str) -> str:
    system_prompt = (
        "You are an expert software debugger. "
        "The user will provide a code snippet. Your job is to:\n"
        "1. Identify any bugs, errors, or code smells.\n"
        "2. Explain WHY each issue is a problem.\n"
        "3. Provide a corrected version of the code.\n"
        "Format your response with three sections: "
        "**Issues Found**, **Explanation**, and **Fixed Code**."
    )
    return await _call_llm(system_prompt, input_text)


async def research(input_text: str) -> str:
    system_prompt = (
        "You are a research assistant with broad knowledge. "
        "Answer the user's question thoroughly but concisely. "
        "Structure your response with: "
        "**Summary** (2-3 sentences), "
        "**Key Points** (3-5 bullet points), and "
        "**Further Reading** (2 suggested search queries). "
        "Be factual, balanced, and cite approximate sources where helpful."
    )
    return await _call_llm(system_prompt, input_text)


# Agent Registry
AgentFn = Callable[[str], Coroutine[Any, Any, str]]


class AgentDefinition:
    def __init__(
        self,
        agent_id: str,
        name: str,
        description: str,
        price_usdc: float,
        fn: AgentFn,
    ) -> None:
        self.agent_id = agent_id
        self.name = name
        self.description = description
        self.price_usdc = price_usdc
        self.fn = fn


AGENT_REGISTRY: dict[str, AgentDefinition] = {
    "summarizer": AgentDefinition(
        agent_id="summarizer",
        name="📝 Summarizer",
        description="Distills any text into a concise summary paragraph instantly.",
        price_usdc=AGENT_PRICES["summarizer"],
        fn=summarize,
    ),
    "debugger": AgentDefinition(
        agent_id="debugger",
        name="🐛 Code Debugger",
        description="Spots bugs in your code and returns a corrected version with explanations.",
        price_usdc=AGENT_PRICES["debugger"],
        fn=debug_code,
    ),
    "researcher": AgentDefinition(
        agent_id="researcher",
        name="🔬 Researcher",
        description="Answers any research question with a structured, factual breakdown.",
        price_usdc=AGENT_PRICES["researcher"],
        fn=research,
    ),
}


async def run_agent(agent_id: str, input_text: str) -> str:
    if agent_id not in AGENT_REGISTRY:
        raise ValueError(f"Unknown agent_id '{agent_id}'. Valid IDs: {list(AGENT_REGISTRY)}")

    agent = AGENT_REGISTRY[agent_id]
    logger.info("Running agent '%s' | input length: %d chars", agent_id, len(input_text))
    result = await agent.fn(input_text)
    logger.info("Agent '%s' completed successfully.", agent_id)
    return result