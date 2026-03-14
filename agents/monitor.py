"""Monitor agent node — polls Prometheus/Grafana and detects anomalies."""

import json
import logging
import re

from langchain_core.tools import BaseTool

from agents.config import get_llm

logger = logging.getLogger(__name__)
from agents.llm_utils import run_agent_with_tools
from agents.prompts import MONITOR_SYSTEM_PROMPT
from agents.state import PipelineState


def _parse_anomalies(text: str) -> list[dict]:
    """Extract JSON anomaly list from LLM response text."""
    match = re.search(r"```json\s*([\s\S]*?)```", text)
    if match:
        try:
            return json.loads(match.group(1))
        except json.JSONDecodeError:
            pass
    # Fallback: try to find a JSON array directly
    match = re.search(r"\[[\s\S]*?\]", text)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    return []


async def monitor_node(state: PipelineState, tools: list[BaseTool]) -> dict:
    """Check all services for anomalies using Prometheus and Grafana tools."""
    logger.info("=== MONITOR AGENT (iteration %d) ===", state.get("iteration", 0))
    llm = get_llm()
    messages, content = await run_agent_with_tools(
        llm=llm,
        tools=tools,
        system_prompt=MONITOR_SYSTEM_PROMPT,
        max_tool_rounds=3,
        human_message=(
            "Check all services for anomalies. Query these key metrics:\n"
            "- gateway_error_rate\n"
            "- payment_failure_rate\n"
            "- gateway_request_duration_seconds\n"
            "- payment_processing_duration_seconds\n"
            "- user_request_duration_seconds\n"
            "- order_processing_duration_seconds\n"
            "- cache_hit_ratio\n"
            "Also check target health with get_targets."
        ),
    )

    anomalies = _parse_anomalies(content)
    # Strip the JSON block from content to get the summary
    health_summary = re.sub(r"```json[\s\S]*?```", "", content).strip()

    if anomalies:
        logger.info("  Found %d anomaly(ies):", len(anomalies))
        for a in anomalies:
            logger.info("    [%s] %s — %s = %s (threshold %s)",
                        a.get("severity", "?").upper(), a.get("service"), a.get("metric"),
                        a.get("value"), a.get("threshold"))
    else:
        logger.info("  No anomalies detected — infrastructure healthy")

    return {
        "messages": messages,
        "anomalies": anomalies,
        "health_summary": health_summary or "Health check completed.",
        "has_anomalies": len(anomalies) > 0,
    }
