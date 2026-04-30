"""API Gateway — routes requests to downstream services."""

import json
import logging
import random
import threading
import time
from collections import deque
from datetime import UTC, datetime

from fastapi import FastAPI, Response
from prometheus_client import Counter, Gauge, Histogram, generate_latest

app = FastAPI(title="api-gateway")
logger = logging.getLogger("api-gateway")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False

_LOG_BUFFER_MAX = 500
_LOG_EXCERPT_MAX_CHARS = 240
_log_buffer: deque[dict] = deque(maxlen=_LOG_BUFFER_MAX)


def _sanitize_payload_excerpt(value: object) -> str:
    text = str(value)
    text = text.replace("```", "'''")
    lower_markers = {
        "system:": "system_(untrusted):",
        "developer:": "developer_(untrusted):",
        "user:": "user_(untrusted):",
        "assistant:": "assistant_(untrusted):",
    }
    lowered = text.lower()
    for marker, replacement in lower_markers.items():
        if marker in lowered:
            text = text.replace(marker, replacement).replace(marker.upper(), replacement)
    text = text.replace("Ignore previous instructions", "[UNTRUSTED_INSTRUCTION_IGNORED]")
    text = text.replace("ignore previous instructions", "[UNTRUSTED_INSTRUCTION_IGNORED]")
    return text[:_LOG_EXCERPT_MAX_CHARS]


def _log_event(
    event_type: str,
    message: str,
    *,
    severity: str = "INFO",
    endpoint: str | None = None,
    request_id: str | None = None,
    third_party: str | None = None,
    error_code: str | None = None,
    payload: object | None = None,
) -> None:
    entry = {
        "timestamp": datetime.now(UTC).isoformat(),
        "service": "api-gateway",
        "event_type": event_type,
        "severity": severity,
        "endpoint": endpoint or "",
        "request_id": request_id or "",
        "third_party": third_party or "",
        "error_code": error_code or "",
        "message": message,
        "payload_excerpt": _payload_excerpt(payload) if payload is not None else "",
        "untrusted_payload": payload is not None,
    }
    _log_buffer.append(entry)
    logger.info(json.dumps(entry, ensure_ascii=True))

# --- Prometheus metrics ---
REQUEST_COUNT = Counter(
    "gateway_requests_total",
    "Total requests handled by the gateway",
    ["method", "endpoint", "status"],
)
REQUEST_LATENCY = Histogram(
    "gateway_request_duration_seconds",
    "Request latency in seconds",
    ["endpoint"],
    buckets=[0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0, 2.5],
)
ERROR_RATE = Gauge("gateway_error_rate", "Current error rate (0-1)")
ACTIVE_CONNECTIONS = Gauge("gateway_active_connections", "Active connections")

# --- Anomaly injection state ---
anomaly = {"enabled": False, "type": None}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "api-gateway"}


@app.post("/inject")
def inject(anomaly_type: str | None = None):
    """Toggle anomaly injection. POST /inject?anomaly_type=latency | error | none"""
    if anomaly_type in (None, "none"):
        anomaly["enabled"] = False
        anomaly["type"] = None
        _log_event("anomaly_toggle", "Anomaly injection disabled", endpoint="/inject", payload=anomaly_type)
        return {"anomaly": "disabled"}
    anomaly["enabled"] = True
    anomaly["type"] = anomaly_type
    _log_event("anomaly_toggle", "Anomaly injection enabled", endpoint="/inject", payload=anomaly_type)
    return {"anomaly": anomaly_type, "status": "enabled"}


@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type="text/plain")


@app.get("/logs")
def logs(level: str = "INFO", limit: int = 200):
    level_upper = level.upper()
    capped_limit = max(1, min(limit, 500))
    entries = [e for e in _log_buffer if e.get("severity", "INFO") == level_upper]
    return {"service": "api-gateway", "level": level_upper, "entries": entries[-capped_limit:], "truncated": len(entries) > capped_limit}


# --- Background traffic simulator ---
def _simulate():
    endpoints = ["/api/orders", "/api/users", "/api/payments", "/api/health"]
    tick = 0
    while True:
        tick += 1
        ep = random.choice(endpoints)
        method = random.choice(["GET", "POST"])

        # Base latency
        latency = random.uniform(0.005, 0.08)
        error = random.random() < 0.02  # 2% base error rate

        if anomaly["enabled"]:
            if anomaly["type"] == "latency":
                latency += random.uniform(0.5, 2.0)
            elif anomaly["type"] == "error":
                error = random.random() < 0.35

        status = "5xx" if error else random.choice(["2xx", "2xx", "2xx", "3xx"])
        REQUEST_COUNT.labels(method=method, endpoint=ep, status=status).inc()
        REQUEST_LATENCY.labels(endpoint=ep).observe(latency)
        ERROR_RATE.set(0.35 if (anomaly["enabled"] and anomaly["type"] == "error") else 0.02)
        ACTIVE_CONNECTIONS.set(random.randint(10, 150))

        if error:
            _log_event(
                "request_failure",
                "Gateway request failed while routing to downstream service",
                severity="INFO",
                endpoint=ep,
                error_code="UPSTREAM_5XX",
                third_party="downstream-service",
                payload={"method": method, "status": status},
            )
        elif tick % 20 == 0:
            _log_event(
                "request_summary",
                "Gateway traffic steady",
                severity="INFO",
                endpoint=ep,
                payload={"method": method, "status": status},
            )

        time.sleep(random.uniform(0.5, 1.5))


threading.Thread(target=_simulate, daemon=True).start()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
