"""End-to-end tests — validate full anomaly detection scenarios.

Requires: docker compose up
Run with: pytest tests/e2e/
"""

import time
import pytest
import httpx

pytestmark = pytest.mark.e2e

SERVICE_URLS = {
    "api-gateway": "http://localhost:8080",
    "payment-service": "http://localhost:8001",
    "user-service": "http://localhost:8002",
    "order-service": "http://localhost:8003",
    "redis-cache": "http://localhost:8004",
}

PROMETHEUS_URL = "http://localhost:9090"


@pytest.fixture(scope="module")
def client():
    with httpx.Client(timeout=10.0) as c:
        yield c


def promql(client: httpx.Client, query: str) -> list:
    resp = client.get(f"{PROMETHEUS_URL}/api/v1/query", params={"query": query})
    assert resp.status_code == 200
    return resp.json()["data"]["result"]


def test_prometheus_scrapes_all_services(client):
    """Prometheus must have active targets for every service."""
    resp = client.get(f"{PROMETHEUS_URL}/api/v1/targets")
    assert resp.status_code == 200
    active = resp.json()["data"]["activeTargets"]
    up_jobs = {t["labels"]["job"] for t in active if t["health"] == "up"}
    expected_jobs = {"api-gateway", "payment-service", "user-service", "order-service", "redis-cache"}
    assert expected_jobs.issubset(up_jobs), f"Missing healthy targets: {expected_jobs - up_jobs}"


def test_gateway_error_rate_spikes_after_inject(client):
    """gateway_error_rate should jump above 0.30 within 15s of injecting error anomaly."""
    client.post(f"{SERVICE_URLS['api-gateway']}/inject", params={"anomaly_type": "error"})
    try:
        deadline = time.time() + 15
        while time.time() < deadline:
            results = promql(client, "gateway_error_rate")
            if results and float(results[0]["value"][1]) > 0.30:
                return  # passed
            time.sleep(2)
        pytest.fail("gateway_error_rate did not exceed 0.30 within 15s")
    finally:
        client.post(f"{SERVICE_URLS['api-gateway']}/inject", params={"anomaly_type": "none"})


def test_payment_failure_rate_spikes_after_inject(client):
    """payment_failure_rate should jump above 0.30 within 15s."""
    client.post(f"{SERVICE_URLS['payment-service']}/inject", params={"anomaly_type": "error"})
    try:
        deadline = time.time() + 15
        while time.time() < deadline:
            results = promql(client, "payment_failure_rate")
            if results and float(results[0]["value"][1]) > 0.30:
                return
            time.sleep(2)
        pytest.fail("payment_failure_rate did not exceed 0.30 within 15s")
    finally:
        client.post(f"{SERVICE_URLS['payment-service']}/inject", params={"anomaly_type": "none"})


def test_cascade_failure_affects_multiple_services(client):
    """After cascade injection all dependent services should show elevated metrics."""
    # Inject cascade
    inject_map = {
        "redis-cache": "memory_leak",
        "payment-service": "latency",
        "user-service": "latency",
        "order-service": "latency",
        "api-gateway": "error",
    }
    for service, anomaly in inject_map.items():
        client.post(f"{SERVICE_URLS[service]}/inject", params={"anomaly_type": anomaly})

    # Wait for metrics to propagate
    time.sleep(5)

    try:
        # Gateway should show elevated error rate
        gw_results = promql(client, "gateway_error_rate")
        assert gw_results, "No gateway_error_rate metric found"
        assert float(gw_results[0]["value"][1]) > 0.20

        # Redis memory usage should be climbing — just verify metric exists and > 0
        redis_results = promql(client, "cache_memory_used_bytes")
        assert redis_results, "No cache_memory_used_bytes metric found"
        assert float(redis_results[0]["value"][1]) > 0

    finally:
        for url in SERVICE_URLS.values():
            client.post(f"{url}/inject", params={"anomaly_type": "none"})
