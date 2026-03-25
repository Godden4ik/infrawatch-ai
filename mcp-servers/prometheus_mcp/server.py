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

def _make_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=PROMETHEUS_URL, timeout=30.0)


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
