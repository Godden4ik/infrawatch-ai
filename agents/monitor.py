"""Monitor agent node — polls Prometheus/Grafana and detects anomalies."""

import json
import logging
import re

from langchain_core.tools import BaseTool

from agents.providers import get_llm

logger = logging.getLogger(__name__)
from agents.llm_utils import run_agent_with_tools
from agents.prompts import MONITOR_SYSTEM_PROMPT
from agents.state import PipelineState


_REQUIRED_ANOMALY_FIELDS = {"service", "metric", "value", "threshold", "severity"}


def _parse_anomalies(text: str) -> list[dict]:
    """Extract JSON anomaly list from the LLM response.

    Only accepts fenced code blocks to prevent bare arrays in prose from being
    misidentified as anomaly lists.  Tries in order:
    1. ```json ... ``` fenced block
    2. ``` ... ``` fenced block (no language tag, content starts with '[')

    Each entry must have service, metric, value, threshold, and severity fields.
    """
    candidates = []

    # 1. ```json ... ```
    m = re.search(r"```json\s*([\s\S]*?)```", text)
    if m:
        candidates.append(m.group(1).strip())

    # 2. ``` ... ``` (no language tag, content starts with '[')
    for m in re.finditer(r"```\s*(\[[\s\S]*?)```", text):
        candidates.append(m.group(1).strip())

    for candidate in candidates:
        try:
            data = json.loads(candidate)
            if isinstance(data, list):
                valid = [
                    item for item in data
                    if isinstance(item, dict) and _REQUIRED_ANOMALY_FIELDS.issubset(item.keys())
                ]
                if valid:
                    return valid
        except json.JSONDecodeError:
            continue

    return []


async def monitor_node(state: PipelineState, tools: list[BaseTool], llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None) -> dict:
    """Check all services for anomalies using Prometheus and Grafana tools."""
    logger.info("=== MONITOR AGENT (iteration %d) ===", state.get("iteration", 0))
    llm = get_llm(provider=llm_provider, model=llm_model, api_key=api_key)
    messages, content = await run_agent_with_tools(
        llm=llm,
        tools=tools,
        system_prompt=MONITOR_SYSTEM_PROMPT,
        max_tool_rounds=4,
        human_message=(
            "Check all services for anomalies. Use INSTANT queries only (no start/end args).\n\n"
            "Run execute_promql for each of these expressions:\n"
            "- histogram_quantile(0.95, rate(gateway_request_duration_seconds_bucket[5m]))\n"
            "- histogram_quantile(0.95, rate(payment_processing_duration_seconds_bucket[5m]))\n"
            "- histogram_quantile(0.95, rate(user_request_duration_seconds_bucket[5m]))\n"
            "- histogram_quantile(0.95, rate(order_processing_duration_seconds_bucket[5m]))\n"
            "- gateway_error_rate\n"
            "- payment_failure_rate\n"
            "- redis_cache_hit_ratio\n\n"
            "Then call get_targets to check scrape health.\n\n"
            "After all tool calls, you MUST output a JSON block in EXACTLY this format:\n"
            "```json\n"
            '[{"service": "name", "metric": "name", "value": 0.0, "threshold": 0.0, "severity": "critical|warning|info"}]\n'
            "```\n"
            "Output an empty list ```json\n[]\n``` if everything is healthy. "
            "The JSON block is REQUIRED — do not skip it."
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
