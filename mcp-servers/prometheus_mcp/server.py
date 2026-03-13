"""Prometheus MCP Server — exposes PromQL and target tools for agents."""

import json
import os

import httpx
from mcp.server.fastmcp import FastMCP

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")

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

_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(base_url=PROMETHEUS_URL, timeout=30.0)
    return _client


@mcp.tool()
async def execute_promql(
    query: str,
    start: str | None = None,
    end: str | None = None,
    step: str | None = None,
) -> str:
    """Execute a PromQL query against Prometheus.

    For instant queries, provide only `query`.
    For range queries, provide `query`, `start`, `end` (ISO timestamps or relative like '1h'),
    and optionally `step` (default '15s').
    """
    client = await _get_client()
    try:
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
async def list_metrics() -> str:
    """List all available Prometheus metric names."""
    client = await _get_client()
    try:
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
    client = await _get_client()
    try:
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
