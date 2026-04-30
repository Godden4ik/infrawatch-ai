"""Prometheus MCP Server — exposes PromQL and target tools for agents."""

import json
import os

import httpx
from mcp.server.fastmcp import FastMCP

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")


def _service_base_url(
    service_name: str,
    host_env: str,
    default_host: str,
    default_port: int,
) -> str:
    """Resolve service URL in Docker or local runs.

    Priority:
    1) explicit *_URL env var
    2) *_HOST env var + known port
    3) localhost + known port
    """
    explicit_url = os.getenv(f"{host_env.replace('_HOST', '_URL')}")
    if explicit_url:
        return explicit_url

    host = os.getenv(host_env, default_host)
    return f"http://{host}:{default_port}"


SERVICE_LOG_URLS = {
    "api-gateway": _service_base_url("api-gateway", "API_GATEWAY_HOST", "localhost", 8080),
    "payment-service": _service_base_url("payment-service", "PAYMENT_SERVICE_HOST", "localhost", 8001),
    "user-service": _service_base_url("user-service", "USER_SERVICE_HOST", "localhost", 8002),
    "order-service": _service_base_url("order-service", "ORDER_SERVICE_HOST", "localhost", 8003),
    "redis-cache": _service_base_url("redis-cache", "REDIS_CACHE_HOST", "localhost", 8004),
}

mcp = FastMCP(
    name="prometheus-mcp",
    instructions=(
        "Prometheus metrics server for InfraWatch infrastructure. "
        "Available metrics include: "
        "gateway_requests_total, gateway_request_duration_seconds, gateway_error_rate, gateway_active_connections, "
        "payment_transactions_total, payment_processing_duration_seconds, payment_failure_rate, payment_pending_transactions, payment_revenue_dollars_total, "
        "user_auth_attempts_total, user_request_duration_seconds, user_active_sessions, user_registrations_total, "
        "order_processed_total, order_processing_duration_seconds, order_queue_depth, order_errors_total, "
        "cache_hits_total, cache_misses_total, cache_hit_ratio, cache_memory_used_bytes, cache_memory_max_bytes, cache_connected_clients, cache_evicted_keys_total, cache_keys_total."
    ),
)

def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=PROMETHEUS_URL, timeout=30.0)


def _make_service_client(base_url: str) -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=base_url, timeout=10.0)


@mcp.tool()
async def execute_promql(
    query: str,
    start: str | None = None,
    end: str | None = None,
    step: str | None = None,
) -> str:
    """Execute a PromQL query against Prometheus.

    For instant queries (recommended), provide only `query` — do NOT set start or end.
    The PromQL expression itself handles the time window, e.g. rate(metric[5m]).

    For range queries, provide `query`, `start`, and `end` as Unix epoch seconds
    (e.g. start="1700000000", end="1700003600") and optionally `step` (default '15s').
    Relative strings like '1h' are NOT valid — use Unix timestamps only.
    """
    try:
        async with _make_client() as client:
            if start and end:
                params = {"query": query, "start": start, "end": end, "step": step or "15s"}
                resp = await client.get("/api/v1/query_range", params=params)
            else:
                resp = await client.get("/api/v1/query", params={"query": query})
            resp.raise_for_status()
            return json.dumps(resp.json()["data"], indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"Prometheus returned {e.response.status_code}", "detail": e.response.text})
    except httpx.ConnectError:
        return json.dumps({"error": f"Cannot connect to Prometheus at {PROMETHEUS_URL}"})


@mcp.tool()
async def get_service_logs(service_name: str, level: str = "INFO", limit: int = 200) -> str:
    """Fetch recent structured application logs for a service.

    Reads from each service's `/logs` endpoint and returns bounded JSON entries.
    """
    base_url = SERVICE_LOG_URLS.get(service_name)
    if not base_url:
        return json.dumps(
            {
                "error": f"Unknown service '{service_name}'",
                "known_services": sorted(SERVICE_LOG_URLS.keys()),
            }
        )

    capped_limit = max(1, min(int(limit), 500))
    level_upper = level.upper()

    try:
        async with _make_service_client(base_url) as client:
            resp = await client.get("/logs", params={"level": level_upper, "limit": capped_limit})
            resp.raise_for_status()
            data = resp.json()
            return json.dumps(
                {
                    "service": service_name,
                    "source": f"{base_url}/logs",
                    "level": level_upper,
                    "limit": capped_limit,
                    "truncated": bool(data.get("truncated", False)),
                    "entries": data.get("entries", []),
                },
                indent=2,
            )
    except httpx.HTTPStatusError as e:
        return json.dumps(
            {
                "error": f"Service logs endpoint returned {e.response.status_code}",
                "service": service_name,
                "detail": e.response.text,
            }
        )
    except httpx.ConnectError:
        return json.dumps({"error": f"Cannot connect to service '{service_name}' logs at {base_url}"})


@mcp.tool()
async def list_metrics() -> str:
    """List all available Prometheus metric names."""
    try:
        async with _make_client() as client:
            resp = await client.get("/api/v1/label/__name__/values")
            resp.raise_for_status()
            return json.dumps(resp.json()["data"], indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"Prometheus returned {e.response.status_code}", "detail": e.response.text})
    except httpx.ConnectError:
        return json.dumps({"error": f"Cannot connect to Prometheus at {PROMETHEUS_URL}"})


@mcp.tool()
async def get_targets() -> str:
    """Get Prometheus scrape target health status for all monitored services."""
    try:
        async with _make_client() as client:
            resp = await client.get("/api/v1/targets")
            resp.raise_for_status()
            data = resp.json()["data"]
            targets = [
                {
                    "job": t["labels"].get("job"),
                    "instance": t["labels"].get("instance"),
                    "health": t["health"],
                    "lastScrape": t.get("lastScrape"),
                    "lastError": t.get("lastError", ""),
                }
                for t in data.get("activeTargets", [])
            ]
            return json.dumps(targets, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"Prometheus returned {e.response.status_code}", "detail": e.response.text})
    except httpx.ConnectError:
        return json.dumps({"error": f"Cannot connect to Prometheus at {PROMETHEUS_URL}"})


if __name__ == "__main__":
    mcp.run(transport="stdio")
