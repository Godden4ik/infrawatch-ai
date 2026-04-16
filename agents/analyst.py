"""Analyst agent node — traces root cause through the dependency graph."""

import json
import logging
import re

from langchain_core.tools import BaseTool

from agents.providers import get_llm

logger = logging.getLogger(__name__)
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


async def analyst_node(state: PipelineState, tools: list[BaseTool], llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None) -> dict:
    """Analyze anomalies by querying the dependency graph for root cause."""
    logger.info("=== ANALYST AGENT ===")
    logger.info("  Analyzing %d anomaly(ies) across: %s",
                len(state["anomalies"]),
                ", ".join({a.get("service", "?") for a in state["anomalies"]}))
    llm = get_llm(provider=llm_provider, model=llm_model, api_key=api_key)
    anomalies_json = json.dumps(state["anomalies"], indent=2)
    messages, content = await run_agent_with_tools(
        llm=llm,
        tools=tools,
        system_prompt=ANALYST_SYSTEM_PROMPT,
        max_tool_rounds=4,
        human_message=(
            f"Detected anomalies:\n{anomalies_json}\n\n"
            f"Health summary: {state.get('health_summary', 'N/A')}\n\n"
            "Trace the root cause through the dependency graph and assess blast radius."
        ),
    )

    analysis = _parse_analysis(content)
    logger.info("  Root cause: %s", analysis.get("root_cause", "(not parsed)")[:120])
    logger.info("  Confidence: %.2f | Blast radius: %d service(s)",
                analysis.get("confidence", 0.5), len(analysis.get("blast_radius", [])))

    # Build rich runbook/incident dicts by mining tool results from message history
    rb_details: dict[str, dict] = {}
    inc_details: dict[str, dict] = {}
    for msg in messages:
        if msg.__class__.__name__ != "ToolMessage":
            continue
        try:
            payload = json.loads(msg.content.replace("\n[truncated]", ""))
            # search_runbooks returns a list of runbook step dicts
            if isinstance(payload, list):
                for item in payload:
                    rb_id = item.get("runbook_id")
                    if rb_id and rb_id not in rb_details:
                        rb_details[rb_id] = {
                            "id": rb_id,
                            "runbook_title": item.get("runbook_title", rb_id),
                            "step_title": item.get("step_title", ""),
                        }
                    inc_id = item.get("incident_id")
                    if inc_id and inc_id not in inc_details:
                        inc_details[inc_id] = {
                            "id": inc_id,
                            "title": item.get("title", inc_id),
                            "root_cause": item.get("root_cause", ""),
                        }
            elif isinstance(payload, dict):
                for item in payload.get("runbook_results", []):
                    rb_id = item.get("runbook_id")
                    if rb_id and rb_id not in rb_details:
                        rb_details[rb_id] = {
                            "id": rb_id,
                            "runbook_title": item.get("runbook_title", rb_id),
                            "step_title": item.get("step_title", ""),
                        }
                for item in payload.get("incident_results", []):
                    inc_id = item.get("incident_id")
                    if inc_id and inc_id not in inc_details:
                        inc_details[inc_id] = {
                            "id": inc_id,
                            "title": item.get("title", inc_id),
                            "root_cause": item.get("root_cause", ""),
                        }
        except (json.JSONDecodeError, AttributeError):
            pass

    # Merge IDs from analysis JSON with any richer details found in tool results
    relevant_runbooks = [
        rb_details.get(rid, {"id": rid, "runbook_title": rid})
        for rid in analysis.get("relevant_runbooks", [])
    ]
    similar_incidents = [
        inc_details.get(iid, {"id": iid, "title": iid})
        for iid in analysis.get("similar_incidents", [])
    ]
    # Also include any tool-result entries not explicitly cited in the JSON
    for rb_id, rb in rb_details.items():
        if not any(r["id"] == rb_id for r in relevant_runbooks):
            relevant_runbooks.append(rb)
    for inc_id, inc in inc_details.items():
        if not any(i["id"] == inc_id for i in similar_incidents):
            similar_incidents.append(inc)
    logger.info("  Similar incidents: %s | Relevant runbooks: %s",
                [i["id"] for i in similar_incidents],
                [r["id"] for r in relevant_runbooks])

    return {
        "messages": messages,
        "root_cause": analysis.get("root_cause", content),
        "blast_radius": analysis.get("blast_radius", []),
        "confidence": analysis.get("confidence", 0.5),
        "similar_incidents": similar_incidents,
        "relevant_runbooks": relevant_runbooks,
        "iteration": state.get("iteration", 0) + 1,
    }
