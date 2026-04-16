"""End-to-end pipeline accuracy tests — validates Monitor detection and Analyst blast radius.

Requires: docker compose up (active Prometheus, Neo4j, and simulator stack)
Run with: pytest tests/e2e/test_pipeline_accuracy.py
"""

import os
import asyncio
import json
import httpx
import pytest
from agents import run_pipeline
from agents.tools import create_mcp_client
from langchain_mcp_adapters.tools import load_mcp_tools

pytestmark = [pytest.mark.e2e, pytest.mark.asyncio]

SERVICE_URLS = {
    "api-gateway": "http://localhost:8080",
    "payment-service": "http://localhost:8001",
    "user-service": "http://localhost:8002",
    "order-service": "http://localhost:8003",
    "redis-cache": "http://localhost:8004",
}


@pytest.fixture(scope="module")
def http_client():
    """Shared HTTP client for anomaly injection."""
    with httpx.Client(timeout=30.0) as c:
        yield c


# Cache for ground truth to avoid redundant MCP calls
_GROUND_TRUTH_CACHE = {
    "blast_radius": {},  # service_name -> set of affected services
    "runbooks": {},      # service_name -> set of runbook IDs
}


async def get_ground_truth_blast_radius(service_name: str) -> set[str]:
    """Fetch expected blast radius directly from Neo4j MCP tool (with caching)."""
    if service_name in _GROUND_TRUTH_CACHE["blast_radius"]:
        return _GROUND_TRUTH_CACHE["blast_radius"][service_name]

    client = create_mcp_client()
    async with client.session("neo4j") as session:
        tools = await load_mcp_tools(session)
        tool = next(t for t in tools if t.name == "get_blast_radius")
        result_json = await tool.ainvoke({"service_name": service_name})
        result = json.loads(result_json)
        affected = {x["service"] for x in result.get("affected", [])}
        _GROUND_TRUTH_CACHE["blast_radius"][service_name] = affected
        return affected


async def get_ground_truth_runbook_ids_for_services(service_names: set[str]) -> set[str]:
    """Fetch union of runbook IDs for a set of services (with caching)."""
    union_ids = set()
    missing_services = [s for s in service_names if s not in _GROUND_TRUTH_CACHE["runbooks"]]

    if missing_services:
        client = create_mcp_client()
        async with client.session("neo4j") as session:
            tools = await load_mcp_tools(session)
            tool = next(t for t in tools if t.name == "get_runbook_for_service")
            for svc in missing_services:
                result_json = await tool.ainvoke({"service_name": svc})
                result = json.loads(result_json)
                rb_ids = {rb["runbook_id"] for rb in result.get("runbooks", [])}
                _GROUND_TRUTH_CACHE["runbooks"][svc] = rb_ids

    for svc in service_names:
        union_ids.update(_GROUND_TRUTH_CACHE["runbooks"].get(svc, set()))
    
    return union_ids


# Ground-truth mapping for "perfect" runbook IDs (for MRR check)
PERFECT_RUNBOOKS = {
    "redis-cache": "RB-001",
    "payment-service": "RB-002",
    "order-service": "RB-005",
    "user-service": "RB-006",
}


@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set"
)
async def test_pipeline_clean_state(http_client):
    """SPECIFICITY: Ensure no false positives in a clean environment."""
    # Ensure no anomalies are active
    for url in SERVICE_URLS.values():
        http_client.post(f"{url}/inject", params={"anomaly_type": "none"})
    
    await asyncio.sleep(5)  # Wait for stabilization
    
    result = await run_pipeline(verbose=False)
    
    assert result.get("has_anomalies") is False, (
        f"False positive detected! Agent reported anomalies in clean state: {result.get('anomalies')}"
    )
    assert not result.get("anomalies"), "Anomalies list should be empty in clean state."
    assert result.get("confidence", 0) < 0.2, "Confidence should be low for non-existent issues."


@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="ANTHROPIC_API_KEY not set — pipeline requires LLM provider"
)
@pytest.mark.parametrize("service, anomaly_type", [
    ("redis-cache", "cache_failure"),
    ("payment-service", "latency"),
    ("order-service", "latency"),
    ("user-service", "latency"),
])
async def test_pipeline_accuracy(http_client, service, anomaly_type):
    """Inject exactly one anomaly and verify Monitor detection, Analyst recall, and Runbook accuracy."""
    # 1. Inject anomaly
    resp = http_client.post(f"{SERVICE_URLS[service]}/inject", params={"anomaly_type": anomaly_type})
    assert resp.status_code == 200, f"Failed to inject {anomaly_type} into {service}"

    try:
        # 2. Wait for metrics to propagate to Prometheus (10s)
        await asyncio.sleep(10)

        # 3. Run full agent pipeline
        result = await run_pipeline(verbose=False)

        # 4. Accuracy checks
        
        # MONITOR: Was the injected service detected?
        predicted_anomalies = {a["service"] for a in result.get("anomalies", [])}
        assert service in predicted_anomalies, (
            f"Monitor failed to detect injected service '{service}'.\n"
            f"Detected anomalies: {predicted_anomalies}\n"
            f"Anomaly type: {anomaly_type}"
        )

        # SLO ATTRIBUTION: Check if detected metrics exceed Neo4j SLOs
        # Note: This verifies the monitor is using ground-truth thresholds
        client = create_mcp_client()
        async with client.session("neo4j") as session:
            tools = await load_mcp_tools(session)
            cypher_tool = next(t for t in tools if t.name == "run_cypher")
            query = "MATCH (s:Service {name: $name}) RETURN s.slo_latency_ms as lat, s.slo_error_rate as err"
            slo_resp = await cypher_tool.ainvoke({"query": query, "params": json.dumps({"name": service})})
            slo_data = json.loads(slo_resp)[0]

        for anomaly in result.get("anomalies", []):
            if anomaly["service"] == service:
                val = anomaly.get("value", 0)
                if "latency" in anomaly.get("metric", "").lower():
                    assert val > slo_data["lat"], f"Anomaly value {val} should exceed SLO latency {slo_data['lat']}"
                elif "error" in anomaly.get("metric", "").lower() or "failure" in anomaly.get("metric", "").lower():
                    # error_rate in SLO is 0.01-0.05, simulator error rates are 0.3-0.5
                    assert val > slo_data["err"], f"Anomaly value {val} should exceed SLO error rate {slo_data['err']}"

        # ANALYST: RCA Precision
        # Verify the root cause identifies the injected service
        predicted_rca = result.get("root_cause", "").lower()
        assert service.lower() in predicted_rca, (
            f"RCA Precision failure. Expected root cause service '{service}' not found in analyst output.\n"
            f"Analyst Root Cause: {predicted_rca}"
        )

        # ANALYST: Blast Radius Accuracy
        expected_blast_radius = await get_ground_truth_blast_radius(service)
        predicted_blast_radius = {x["service"] for x in result.get("blast_radius", [])}

        intersection_br = predicted_blast_radius.intersection(expected_blast_radius)
        recall_br = len(intersection_br) / len(expected_blast_radius) if expected_blast_radius else 1.0
        
        assert recall_br >= 0.8, (
            f"Analyst blast radius recall too low for {service} ({anomaly_type}).\n"
            f"Expected: {expected_blast_radius}\n"
            f"Predicted: {predicted_blast_radius}\n"
            f"Recall: {recall_br:.2f} (threshold: 0.80)"
        )

        # ANALYST: Runbook Retrieval & Ranking (MRR)
        expected_runbook_ids = await get_ground_truth_runbook_ids_for_services(expected_blast_radius)
        predicted_runbooks = result.get("relevant_runbooks", [])
        predicted_runbook_ids = [rb["id"] for rb in predicted_runbooks]

        assert predicted_runbook_ids, (
            f"Analyst failed to retrieve any relevant runbooks for {service} ({anomaly_type}).\n"
            f"Expected blast radius: {expected_blast_radius}"
        )

        # Check Intersection
        intersection_rb = set(predicted_runbook_ids).intersection(expected_runbook_ids)
        assert len(intersection_rb) >= 1, "Runbook retrieval mismatch (no intersection with ground truth)."

        # Check Ranking Accuracy (MRR-like check for "perfect" runbook)
        perfect_id = PERFECT_RUNBOOKS.get(service)
        if perfect_id:
            # We expect the "perfect" runbook to be in the top 3 results
            top_3_ids = predicted_runbook_ids[:3]
            assert perfect_id in top_3_ids, (
                f"Ranking Accuracy (MRR) failure for {service}.\n"
                f"Expected perfect runbook '{perfect_id}' to be in top 3.\n"
                f"Predicted Top 3: {top_3_ids}"
            )

        # RESPONDER: Remediation Grounding
        remediation_plan = result.get("remediation_plan", "")
        assert remediation_plan, "Responder failed to generate a remediation plan."
        
        found_id_in_plan = any(rb_id in remediation_plan for rb_id in predicted_runbook_ids)
        assert found_id_in_plan, (
            f"Remediation plan is not grounded in retrieved runbooks for {service}.\n"
            f"Predicted Runbook IDs: {predicted_runbook_ids}\n"
            f"Remediation Plan snippet: {remediation_plan[:200]}..."
        )

    finally:
        # Reset anomaly to ensure clean state for next test
        http_client.post(f"{SERVICE_URLS[service]}/inject", params={"anomaly_type": "none"})
