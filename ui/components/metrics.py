"""Prometheus query helpers and metric card rendering."""

import json
import urllib.error
import urllib.parse
import urllib.request

import streamlit as st

PROMETHEUS_URL = "http://localhost:9090"

SERVICE_PORTS = {
    "api-gateway": 8080,
    "payment-service": 8001,
    "user-service": 8002,
    "order-service": 8003,
    "redis-cache": 8004,
}

# SLO thresholds (p95 latency in seconds) — anomaly boundary, not baseline
SLO_LATENCY = {
    "api-gateway": 0.400,
    "payment-service": 2.000,
    "user-service": 0.350,
    "order-service": 5.000,
    "redis-cache": 0.010,
}

# Per-service error rate thresholds (baseline noise varies by service)
SLO_ERROR_RATE = {
    "api-gateway": 0.05,
    "payment-service": 0.05,  # baseline ~3% failure rate is normal
    "user-service": 0.05,
    "order-service": 0.05,
    "redis-cache": 0.05,
}


def query_prometheus(promql: str) -> float | None:
    """Run an instant PromQL query. Returns the first scalar value or None."""
    url = f"{PROMETHEUS_URL}/api/v1/query?query={urllib.parse.quote(promql)}"
    try:
        resp = urllib.request.urlopen(url, timeout=3)
        data = json.loads(resp.read())
        results = data.get("data", {}).get("result", [])
        if results:
            return float(results[0]["value"][1])
    except Exception:
        pass
    return None


def fetch_service_metrics(service: str) -> dict:
    """Fetch key metrics for a given service name."""
    slug = service.replace("-", "_")

    metrics: dict = {"service": service}

    # P95 latency — aggregate over all label dimensions with sum(...) by (le)
    if service == "api-gateway":
        promql = 'histogram_quantile(0.95, sum(rate(gateway_request_duration_seconds_bucket[5m])) by (le))'
    elif service == "payment-service":
        promql = 'histogram_quantile(0.95, sum(rate(payment_processing_duration_seconds_bucket[5m])) by (le))'
    elif service == "user-service":
        promql = 'histogram_quantile(0.95, sum(rate(user_request_duration_seconds_bucket[5m])) by (le))'
    elif service == "order-service":
        promql = 'histogram_quantile(0.95, sum(rate(order_processing_duration_seconds_bucket[5m])) by (le))'
    elif service == "redis-cache":
        # No latency histogram for redis — derive health from cache hit ratio
        promql = None
    else:
        promql = f'histogram_quantile(0.95, sum(rate({slug}_duration_seconds_bucket[5m])) by (le))'

    metrics["p95_latency"] = query_prometheus(promql) if promql else None

    # Error / failure rate
    if service == "api-gateway":
        metrics["error_rate"] = query_prometheus("gateway_error_rate")
    elif service == "payment-service":
        metrics["error_rate"] = query_prometheus("payment_failure_rate")
    elif service == "user-service":
        metrics["error_rate"] = query_prometheus("user_error_rate")
    elif service == "order-service":
        metrics["error_rate"] = query_prometheus("order_error_rate")
    elif service == "redis-cache":
        metrics["error_rate"] = None  # no error_rate metric for redis

    # Cache hit ratio (redis only)
    if service == "redis-cache":
        metrics["cache_hit_ratio"] = query_prometheus("redis_cache_hit_ratio")

    return metrics


def service_status(metrics: dict) -> str:
    """Return 'green', 'yellow', or 'red' based on SLO thresholds."""
    service = metrics["service"]
    error = metrics.get("error_rate") or 0.0

    # Redis has no latency histogram — use cache hit ratio
    if service == "redis-cache":
        hit = metrics.get("cache_hit_ratio")
        if hit is None:
            return "unknown"
        if hit < 0.50:
            return "red"
        if hit < 0.80:
            return "yellow"
        return "green"

    slo = SLO_LATENCY.get(service, 1.0)
    err_threshold = SLO_ERROR_RATE.get(service, 0.05)
    latency = metrics.get("p95_latency")

    if latency is None:
        return "unknown"
    if latency > slo * 2 or error > err_threshold * 2:
        return "red"
    if latency > slo or error > err_threshold:
        return "yellow"
    return "green"


STATUS_EMOJI = {"green": "🟢", "yellow": "🟡", "red": "🔴", "unknown": "⚪"}


def render_metric_card(metrics: dict) -> None:
    """Render a single service metric card in the current column."""
    service = metrics["service"]
    status = service_status(metrics)
    emoji = STATUS_EMOJI[status]

    st.markdown(f"#### {emoji} {service}")

    if service == "redis-cache":
        hit = metrics.get("cache_hit_ratio")
        if hit is not None:
            st.metric("Cache Hit Ratio", f"{hit * 100:.1f}%",
                      delta="SLO: >80%",
                      delta_color="inverse" if hit < 0.80 else "normal")
        else:
            st.metric("Cache Hit Ratio", "N/A")
        st.metric("P95 Latency", "N/A (no histogram)")
        st.metric("Error Rate", "N/A")
        return

    latency = metrics.get("p95_latency")
    slo = SLO_LATENCY.get(service, 1.0)

    if latency is not None:
        st.metric(
            "P95 Latency",
            f"{latency * 1000:.0f} ms",
            delta=f"SLO: {slo * 1000:.0f} ms",
            delta_color="inverse" if latency > slo else "normal",
        )
    else:
        st.metric("P95 Latency", "N/A")

    error = metrics.get("error_rate")
    if error is not None:
        st.metric("Error Rate", f"{error * 100:.2f}%")
    else:
        st.metric("Error Rate", "N/A")
