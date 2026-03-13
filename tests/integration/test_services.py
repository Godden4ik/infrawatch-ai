"""Integration tests — require all services running via docker compose up."""

import pytest
import httpx

pytestmark = pytest.mark.integration

SERVICE_URLS = {
    "api-gateway": "http://localhost:8080",
    "payment-service": "http://localhost:8001",
    "user-service": "http://localhost:8002",
    "order-service": "http://localhost:8003",
    "redis-cache": "http://localhost:8004",
}


@pytest.fixture(scope="module")
def client():
    with httpx.Client(timeout=5.0) as c:
        yield c


@pytest.mark.parametrize("service,url", SERVICE_URLS.items())
def test_health_endpoint(client, service, url):
    resp = client.get(f"{url}/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["service"] == service


@pytest.mark.parametrize("service,url", SERVICE_URLS.items())
def test_metrics_endpoint_returns_prometheus_format(client, service, url):
    resp = client.get(f"{url}/metrics")
    assert resp.status_code == 200
    assert "text/plain" in resp.headers["content-type"]
    # Every service must expose at least one metric
    assert b"# HELP" in resp.content
    assert b"# TYPE" in resp.content


@pytest.mark.parametrize("service,url", SERVICE_URLS.items())
def test_inject_enable_and_disable(client, service, url):
    # Enable latency anomaly
    resp = client.post(f"{url}/inject", params={"anomaly_type": "latency"})
    assert resp.status_code == 200
    assert resp.json()["anomaly"] == "latency"

    # Disable
    resp = client.post(f"{url}/inject", params={"anomaly_type": "none"})
    assert resp.status_code == 200
    assert resp.json()["anomaly"] == "disabled"


def test_cascade_inject_and_reset(client):
    """Inject cascade failure then verify all services reset cleanly."""
    # Inject cascade: redis memory_leak, others latency, gateway error
    inject_map = {
        "redis-cache": "memory_leak",
        "payment-service": "latency",
        "user-service": "latency",
        "order-service": "latency",
        "api-gateway": "error",
    }
    for service, anomaly in inject_map.items():
        resp = client.post(f"{SERVICE_URLS[service]}/inject", params={"anomaly_type": anomaly})
        assert resp.status_code == 200, f"{service} inject failed"

    # Reset all
    for url in SERVICE_URLS.values():
        resp = client.post(f"{url}/inject", params={"anomaly_type": "none"})
        assert resp.status_code == 200

    # All services still healthy after reset
    for service, url in SERVICE_URLS.items():
        resp = client.get(f"{url}/health")
        assert resp.status_code == 200, f"{service} unhealthy after reset"
