"""Analyst agent node — traces root cause through the dependency graph."""

import json
import re

from langchain_core.tools import BaseTool

from agents.config import get_llm
from agents.llm_utils import run_agent_with_tools
from agents.prompts import ANALYST_SYSTEM_PROMPT
from agents.state import PipelineState


def _parse_analysis(text: str) -> dict:
    """Extract root_cause, confidence, and blast_radius from LLM response."""
    match = re.search(r"```json\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    return {}


async def analyst_node(state: PipelineState, tools: list[BaseTool]) -> dict:
    """Analyze anomalies by querying the dependency graph for root cause."""
    llm = get_llm()
    anomalies_json = json.dumps(state["anomalies"], indent=2)
    messages, content = await run_agent_with_tools(
        llm=llm,
        tools=tools,
        system_prompt=ANALYST_SYSTEM_PROMPT,
        max_tool_rounds=8,
        human_message=(
            f"Detected anomalies:\n{anomalies_json}\n\n"
            f"Health summary: {state.get('health_summary', 'N/A')}\n\n"
            "Trace the root cause through the dependency graph and assess blast radius."
        ),
    )

    analysis = _parse_analysis(content)
    return {
        "messages": messages,
        "root_cause": analysis.get("root_cause", content),
        "blast_radius": analysis.get("blast_radius", []),
        "confidence": analysis.get("confidence", 0.5),
        "iteration": state.get("iteration", 0) + 1,
    }
