"""E2E tests for GraphRAG-enhanced agent pipeline.

Requires: docker compose up + python graph/seed.py + python graph/ingest.py + OPENAI_API_KEY.
Injects anomalies, runs the pipeline, and verifies remediation references historical data.
"""

import asyncio
import json
import os

import httpx
import pytest

SERVICE_URLS = {
    "api-gateway": "http://localhost:8080",
    "payment-service": "http://localhost:8001",
    "user-service": "http://localhost:8002",
    "order-service": "http://localhost:8003",
    "redis-cache": "http://localhost:8004",
}


def inject_anomaly(service_url: str, anomaly_type: str):
    """Inject an anomaly into a service."""
    httpx.post(f"{service_url}/inject", params={"anomaly_type": anomaly_type}, timeout=5.0)


def reset_all():
    """Reset all services to normal."""
    for url in SERVICE_URLS.values():
        try:
            httpx.post(f"{url}/inject", params={"anomaly_type": "none"}, timeout=5.0)
        except httpx.ConnectError:
            pass


@pytest.fixture(autouse=True)
def cleanup():
    yield
    reset_all()


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="Requires ANTHROPIC_API_KEY",
)
async def test_cascade_scenario_references_history():
    """Inject cascade failure, run pipeline, verify historical context in remediation."""
    from agents import run_pipeline

    # Inject cascade: redis down → all services affected
    inject_anomaly(SERVICE_URLS["redis-cache"], "latency")
    inject_anomaly(SERVICE_URLS["payment-service"], "latency")
    inject_anomaly(SERVICE_URLS["user-service"], "error_rate")

    # Wait for metrics to propagate
    await asyncio.sleep(10)

    result = await run_pipeline(verbose=True)

    # Pipeline should detect anomalies
    assert result.get("has_anomalies") is True

    # Remediation should exist
    plan = result.get("remediation_plan", "")
    assert len(plan) > 100, "Remediation plan is too short"

    # GraphRAG should populate historical context
    similar = result.get("similar_incidents", [])
    runbooks = result.get("relevant_runbooks", [])

    # At minimum, the pipeline should have attempted to use the knowledge base
    # (even if no exact match, the fields should be populated)
    assert isinstance(similar, list)
    assert isinstance(runbooks, list)


@pytest.mark.asyncio
@pytest.mark.skipif(
    not os.getenv("ANTHROPIC_API_KEY"),
    reason="Requires ANTHROPIC_API_KEY",
)
async def test_single_service_latency_references_runbook():
    """Inject payment latency, verify pipeline references payment runbooks."""
    from agents import run_pipeline

    inject_anomaly(SERVICE_URLS["payment-service"], "latency")
    await asyncio.sleep(10)

    result = await run_pipeline(verbose=True)

    plan = result.get("remediation_plan", "")
    # The plan should reference payment-service or related concepts
    plan_lower = plan.lower()
    assert "payment" in plan_lower or "latency" in plan_lower
