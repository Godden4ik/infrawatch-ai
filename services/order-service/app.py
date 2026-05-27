"""Order Service — order processing and fulfilment."""

import json
import logging
import random
import threading
import time
from collections import deque
from datetime import UTC, datetime

from fastapi import FastAPI
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from starlette.responses import Response

app = FastAPI(title="order-service")
logger = logging.getLogger("order-service")
if not logger.handlers:
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(name)s %(message)s"))
    logger.addHandler(handler)
logger.setLevel(logging.INFO)
logger.propagate = False

_LOG_BUFFER_MAX = 500
_LOG_EXCERPT_MAX_CHARS = 240
_log_buffer: deque[dict] = deque(maxlen=_LOG_BUFFER_MAX)


def _payload_excerpt(value: object) -> str:
    # Keep raw payload visible in service logs; guardrails run in the agent path.
    return str(value)[:_LOG_EXCERPT_MAX_CHARS]


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
        "service": "order-service",
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
ORDER_THROUGHPUT = Counter(
    "order_processed_total",
    "Total orders processed",
    ["status"],  # completed / cancelled / failed
)
QUEUE_DEPTH = Gauge("order_queue_depth", "Orders waiting in queue")
ORDER_ERRORS = Counter(
    "order_errors_total",
    "Total order processing errors",
    ["error_type"],  # validation / timeout / dependency
)
ORDER_PROCESSING_TIME = Histogram(
    "order_processing_duration_seconds",
    "Time to process an order",
    buckets=[0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)

# --- Anomaly injection state ---
anomaly = {"enabled": False, "type": None, "since": None}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "order-service"}


@app.get("/state")
def state():
    return {
        "service": "order-service",
        "anomaly_type": anomaly["type"] if anomaly["enabled"] else None,
        "since": anomaly["since"] if anomaly["enabled"] else None,
    }


@app.post("/inject")
def inject(anomaly_type: str | None = None):
    if anomaly_type in (None, "none"):
        anomaly["enabled"] = False
        anomaly["type"] = None
        anomaly["since"] = None
        _log_event("anomaly_toggle", "Anomaly injection disabled", endpoint="/inject", payload=anomaly_type)
        return {"anomaly": "disabled"}
    anomaly["enabled"] = True
    anomaly["type"] = anomaly_type
    anomaly["since"] = datetime.now(UTC).isoformat()
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
    return {"service": "order-service", "level": level_upper, "entries": entries[-capped_limit:], "truncated": len(entries) > capped_limit}


# --- Background traffic simulator ---
def _simulate():
    queue = 5
    tick = 0
    while True:
        tick += 1
        proc_time = random.uniform(0.2, 1.5)
        failed = random.random() < 0.02  # 2% base error

        if anomaly["enabled"]:
            if anomaly["type"] == "latency":
                proc_time += random.uniform(3.0, 10.0)
            elif anomaly["type"] == "cache_degraded":
                # Simulate DB fallback when redis cache is down
                proc_time += random.uniform(3.0, 7.0)
            elif anomaly["type"] == "error":
                failed = random.random() < 0.30

        ORDER_PROCESSING_TIME.observe(proc_time)

        if failed:
            ORDER_THROUGHPUT.labels(status="failed").inc()
            err_type = random.choice(["validation", "timeout", "dependency"])
            ORDER_ERRORS.labels(error_type=err_type).inc()
            _log_event(
                "order_failure",
                "Order processing failed",
                endpoint="/orders",
                error_code=f"ORDER_{err_type.upper()}",
                payload={"error_type": err_type, "processing_time_seconds": round(proc_time, 3)},
            )
        else:
            status = random.choices(["completed", "cancelled"], weights=[95, 5])[0]
            ORDER_THROUGHPUT.labels(status=status).inc()

        # Queue drift
        queue += random.randint(-2, 3)
        if anomaly["enabled"] and anomaly["type"] == "latency":
            queue += random.randint(2, 8)
        queue = max(0, min(queue, 200))
        QUEUE_DEPTH.set(queue)

        if anomaly["enabled"] and anomaly["type"] in {"cache_degraded", "latency"}:
            _log_event(
                "dependency_degraded",
                "Downstream dependency appears degraded while processing orders",
                endpoint="/orders",
                third_party="inventory-provider",
                error_code="UPSTREAM_TIMEOUT",
                payload={"queue_depth": queue, "processing_time_seconds": round(proc_time, 3)},
            )
        elif tick % 20 == 0:
            _log_event(
                "order_summary",
                "Order processing healthy",
                endpoint="/orders",
                payload={"queue_depth": queue},
            )

        time.sleep(random.uniform(0.8, 2.0))


threading.Thread(target=_simulate, daemon=True).start()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8003)
