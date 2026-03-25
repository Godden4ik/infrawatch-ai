"""Responder agent node — drafts a remediation plan."""

import json

from langchain_core.tools import BaseTool

from agents.config import get_llm
from agents.llm_utils import run_agent_with_tools
from agents.prompts import RESPONDER_SYSTEM_PROMPT
from agents.state import PipelineState


async def responder_node(state: PipelineState, tools: list[BaseTool]) -> dict:
    """Draft a remediation plan based on root cause and blast radius."""
    llm = get_llm()
    blast_json = json.dumps(state.get("blast_radius", []), indent=2)
    messages, content = await run_agent_with_tools(
        llm=llm,
        tools=tools,
        system_prompt=RESPONDER_SYSTEM_PROMPT,
        human_message=(
            f"Root cause: {state.get('root_cause', 'Unknown')}\n\n"
            f"Blast radius:\n{blast_json}\n\n"
            f"Confidence: {state.get('confidence', 0.0)}\n\n"
            "Draft a remediation plan with immediate actions, affected teams, "
            "verification steps, and prevention measures."
        ),
    )

    return {
        "messages": messages,
        "remediation_plan": content,
    }
