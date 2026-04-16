"""Responder agent node — drafts a remediation plan."""

import json
import logging

from langchain_core.tools import BaseTool

from agents.providers import get_llm

logger = logging.getLogger(__name__)
from agents.llm_utils import run_agent_with_tools
from agents.prompts import RESPONDER_SYSTEM_PROMPT
from agents.state import PipelineState


async def responder_node(state: PipelineState, tools: list[BaseTool], llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None) -> dict:
    """Draft a remediation plan based on root cause and blast radius."""
    logger.info("=== RESPONDER AGENT ===")
    logger.info("  Root cause: %s", str(state.get("root_cause", ""))[:100])
    llm = get_llm(provider=llm_provider, model=llm_model, api_key=api_key)
    blast_json = json.dumps(state.get("blast_radius", []), indent=2)
    similar_json = json.dumps(state.get("similar_incidents", []), indent=2)
    runbooks_json = json.dumps(state.get("relevant_runbooks", []), indent=2)
    messages, content = await run_agent_with_tools(
        llm=llm,
        tools=tools,
        system_prompt=RESPONDER_SYSTEM_PROMPT,
        max_tool_rounds=3,
        human_message=(
            f"Root cause: {state.get('root_cause', 'Unknown')}\n\n"
            f"Blast radius:\n{blast_json}\n\n"
            f"Confidence: {state.get('confidence', 0.0)}\n\n"
            f"Similar past incidents:\n{similar_json}\n\n"
            f"Relevant runbooks:\n{runbooks_json}\n\n"
            "Draft a remediation plan with immediate actions (citing runbook IDs), "
            "affected teams, verification steps, prevention measures, and historical context."
        ),
    )

    logger.info("  Remediation plan drafted (%d chars)", len(content))
    return {
        "messages": messages,
        "remediation_plan": content,
    }
