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

def _validate_analysis(raw: dict, fallback_text: str) -> dict:
    """Validate and coerce analysis JSON into a safe schema."""
    safe_root_cause = "Root cause could not be reliably parsed from model output."
    safe_confidence = 0.0
    safe_blast_radius: list[dict] = []
    safe_similar_incidents: list[str] = []
    safe_relevant_runbooks: list[str] = []

    if not isinstance(raw, dict) or not raw:
        snippet = re.sub(r"\s+", " ", fallback_text or "").strip()
        if snippet:
            safe_root_cause = f"{safe_root_cause} (excerpt: {snippet[:120]}...)"
        return {
            "root_cause": safe_root_cause,
            "confidence": safe_confidence,
            "blast_radius": safe_blast_radius,
            "similar_incidents": safe_similar_incidents,
            "relevant_runbooks": safe_relevant_runbooks,
        }

    root_cause = raw.get("root_cause")
    if not isinstance(root_cause, str) or not root_cause.strip():
        root_cause = safe_root_cause

    confidence = raw.get("confidence", safe_confidence)
    if isinstance(confidence, bool) or not isinstance(confidence, (int, float)):
        confidence = safe_confidence
    else:
        confidence = float(confidence)
        if confidence < 0.0 or confidence > 1.0:
            confidence = safe_confidence

    impact_levels = {"direct", "indirect"}
    slo_levels = {"latency", "error_rate", "both"}

    blast_radius_raw = raw.get("blast_radius", [])
    blast_radius: list[dict] = []
    if isinstance(blast_radius_raw, list):
        for item in blast_radius_raw:
            if not isinstance(item, dict):
                continue
            impact_level = item.get("impact_level")
            slo_at_risk = item.get("slo_at_risk")
            if (
                isinstance(impact_level, str)
                and isinstance(slo_at_risk, str)
                and impact_level in impact_levels
                and slo_at_risk in slo_levels
            ):
                blast_radius.append(
                    {
                        "service": item.get("service", ""),
                        "impact_level": impact_level,
                        "slo_at_risk": slo_at_risk,
                    }
                )

    def _coerce_id_list(value: object) -> list[str]:
        if not isinstance(value, list):
            return []
        ids: list[str] = []
        for v in value:
            if isinstance(v, str) and v.strip():
                ids.append(v.strip())
        return ids

    similar_incidents = _coerce_id_list(raw.get("similar_incidents", safe_similar_incidents))
    relevant_runbooks = _coerce_id_list(raw.get("relevant_runbooks", safe_relevant_runbooks))

    return {
        "root_cause": root_cause,
        "confidence": confidence,
        "blast_radius": blast_radius,
        "similar_incidents": similar_incidents,
        "relevant_runbooks": relevant_runbooks,
    }



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
            "Trace the root cause through the dependency graph and assess blast radius.\n"
            "For each anomalous service, call get_service_logs(service_name=<service>, level='INFO', limit=120) "
            "to gather operational evidence from recent logs.\n"
            "If logs indicate repeated timeout, DNS, or upstream 5xx patterns related to a third-party dependency, "
            "include that explicitly in the root cause reasoning."
        ),
    )

    analysis_raw = _parse_analysis(content)
    analysis = _validate_analysis(analysis_raw, fallback_text=content)
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
        "root_cause": analysis.get("root_cause", ""),
        "blast_radius": analysis.get("blast_radius", []),
        "confidence": analysis.get("confidence", 0.0),
        "similar_incidents": similar_incidents,
        "relevant_runbooks": relevant_runbooks,
        "iteration": state.get("iteration", 0) + 1,
    }
