"""Prometheus metrics SSE stream — polls all 26 metrics every 2 seconds."""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()
logger = logging.getLogger(__name__)

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")

METRIC_REGISTRY: dict[str, list[tuple[str, str]]] = {
    "api-gateway": [
        ("p95_latency", "histogram_quantile(0.95, gateway_request_duration_seconds_bucket)"),
        ("request_rate", "rate(gateway_requests_total[30s])"),
        ("error_rate", 'rate(gateway_requests_total{status="5xx"}[30s])'),
        ("active_connections", "gateway_active_connections"),
    ],
    "payment-service": [
        ("p95_latency", "histogram_quantile(0.95, payment_processing_duration_seconds_bucket)"),
        ("transaction_rate", "rate(payment_transactions_total[30s])"),
        ("failure_rate", "payment_failure_rate"),
        ("pending_transactions", "payment_pending_transactions"),
        ("revenue_rate", "rate(payment_revenue_dollars_total[30s])"),
    ],
    "user-service": [
        ("p95_latency", "histogram_quantile(0.95, user_request_duration_seconds_bucket)"),
        ("auth_rate", "rate(user_auth_attempts_total[30s])"),
        ("auth_failure_rate", 'rate(user_auth_attempts_total{result="failure"}[30s])'),
        ("active_sessions", "user_active_sessions"),
        ("registration_rate", "rate(user_registrations_total[30s])"),
    ],
    "order-service": [
        ("p95_latency", "histogram_quantile(0.95, order_processing_duration_seconds_bucket)"),
        ("order_rate", "rate(order_processed_total[30s])"),
        ("queue_depth", "order_queue_depth"),
        ("error_rate", "rate(order_errors_total[30s])"),
    ],
    "redis-cache": [
        ("hit_ratio", "redis_cache_hit_ratio"),
        ("hits_rate", "rate(redis_cache_hits_total[30s])"),
        ("misses_rate", "rate(redis_cache_misses_total[30s])"),
        ("memory_used", "redis_memory_used_bytes"),
        ("memory_max", "redis_memory_max_bytes"),
        ("connected_clients", "redis_connected_clients"),
        ("evicted_keys_rate", "rate(redis_evicted_keys_total[30s])"),
        ("total_keys", "redis_keys_total"),
    ],
}


async def _query_metric(
    client: httpx.AsyncClient, metric_key: str, promql: str
) -> tuple[str, float | None]:
    """Query a single Prometheus metric; returns (metric_key, value | None)."""
    try:
        resp = await client.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": promql},
            timeout=5.0,
        )
        resp.raise_for_status()
        data = resp.json()
        result = data.get("data", {}).get("result", [])
        if result:
            raw = result[0].get("value", [None, None])[1]
            return metric_key, float(raw) if raw is not None else None
        return metric_key, None
    except Exception as exc:
        logger.debug("Metric query failed for %s: %s", metric_key, exc)
        return metric_key, None


async def _poll_all_metrics(client: httpx.AsyncClient) -> dict[str, dict[str, float | None]]:
    """Fetch all metrics in parallel; returns nested dict keyed by service -> metric."""
    tasks = [
        _query_metric(client, metric_key, promql)
        for metrics in METRIC_REGISTRY.values()
        for metric_key, promql in metrics
    ]

    # Build a flat list of (service, metric_key) in the same order as tasks
    order: list[tuple[str, str]] = [
        (service, metric_key)
        for service, metrics in METRIC_REGISTRY.items()
        for metric_key, _ in metrics
    ]

    results = await asyncio.gather(*tasks)

    services: dict[str, dict[str, float | None]] = {s: {} for s in METRIC_REGISTRY}
    for (service, _), (metric_key, value) in zip(order, results):
        services[service][metric_key] = value

    return services


async def _stream_metrics() -> AsyncGenerator[str, None]:
    """Async generator that continuously polls Prometheus and emits SSE frames."""
    yield "retry: 3000\n\n"

    async with httpx.AsyncClient() as client:
        while True:
            try:
                services = await _poll_all_metrics(client)
                timestamp = datetime.now(timezone.utc).isoformat()
                payload = json.dumps({"timestamp": timestamp, "services": services})
                yield f"event: metrics\ndata: {payload}\n\n"
            except Exception as exc:
                logger.error("Metrics poll error: %s", exc)
                error_payload = json.dumps({"error": str(exc)})
                yield f"event: error\ndata: {error_payload}\n\n"

            await asyncio.sleep(2)


@router.get("/stream")
async def metrics_stream():
    return StreamingResponse(
        _stream_metrics(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
