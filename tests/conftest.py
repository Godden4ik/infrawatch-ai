"""Shared pytest fixtures for InfraWatch test suite."""

import pytest
import httpx

# Service base URLs (matches docker-compose.yml port mappings)
SERVICE_URLS = {
    "api-gateway": "http://localhost:8080",
    "payment-service": "http://localhost:8001",
    "user-service": "http://localhost:8002",
    "order-service": "http://localhost:8003",
    "redis-cache": "http://localhost:8004",
}


@pytest.fixture(scope="session")
def service_urls():
    return SERVICE_URLS


@pytest.fixture
def client():
    with httpx.Client(timeout=5.0) as c:
        yield c


@pytest.fixture(autouse=True)
def reset_anomalies(request, client):
    """Reset all anomalies after each integration/e2e test."""
    if "integration" in str(request.fspath) or "e2e" in str(request.fspath):
        yield
        for url in SERVICE_URLS.values():
            try:
                client.post(f"{url}/inject", params={"anomaly_type": "none"})
            except httpx.ConnectError:
                pass
    else:
        yield
