"""Payment Service — processes transactions."""

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

app = FastAPI(title="payment-service")
logger = logging.getLogger("payment-service")
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
        "service": "payment-service",
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
TRANSACTION_COUNT = Counter(
    "payment_transactions_total",
    "Total transactions processed",
    ["status", "payment_method"],
)
PROCESSING_TIME = Histogram(
    "payment_processing_duration_seconds",
    "Transaction processing time",
    ["payment_method"],
    buckets=[0.05, 0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0],
)
FAILURE_RATE = Gauge("payment_failure_rate", "Current payment failure rate (0-1)")
PENDING_TRANSACTIONS = Gauge("payment_pending_transactions", "Transactions in queue")
REVENUE = Counter("payment_revenue_dollars_total", "Total revenue processed in dollars")

# --- Anomaly injection state ---
anomaly = {"enabled": False, "type": None}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "payment-service"}


@app.post("/inject")
def inject(anomaly_type: str | None = None):
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
    return {"service": "payment-service", "level": level_upper, "entries": entries[-capped_limit:], "truncated": len(entries) > capped_limit}


# --- Background traffic simulator ---
def _simulate():
    methods = ["credit_card", "debit_card", "bank_transfer", "crypto"]
    tick = 0
    while True:
        tick += 1
        pm = random.choice(methods)

        proc_time = random.uniform(0.1, 0.8)
        failed = random.random() < 0.03  # 3% base failure

        if anomaly["enabled"]:
            if anomaly["type"] == "latency":
                proc_time += random.uniform(2.0, 8.0)
            elif anomaly["type"] == "cache_degraded":
                # Simulate DB fallback when redis cache is down
                proc_time += random.uniform(3.0, 7.0)
            elif anomaly["type"] == "error":
                failed = random.random() < 0.40

        status = "failed" if failed else "success"
        TRANSACTION_COUNT.labels(status=status, payment_method=pm).inc()
        PROCESSING_TIME.labels(payment_method=pm).observe(proc_time)
        FAILURE_RATE.set(0.40 if (anomaly["enabled"] and anomaly["type"] == "error") else 0.03)
        PENDING_TRANSACTIONS.set(random.randint(0, 25))

        if not failed:
            REVENUE.inc(random.uniform(5.0, 500.0))
        else:
            _log_event(
                "transaction_failed",
                "Payment transaction failed",
                endpoint="/payments",
                error_code="PAYMENT_FAILED",
                payload={"payment_method": pm, "anomaly": anomaly.get("type")},
            )

        if anomaly["enabled"] and anomaly["type"] in {"cache_degraded", "latency"}:
            _log_event(
                "third_party_latency",
                "Third-party payment processor latency observed",
                endpoint="/payments",
                third_party="payment-processor-api",
                error_code="UPSTREAM_TIMEOUT",
                payload={"payment_method": pm, "processing_time_seconds": round(proc_time, 3)},
            )
        elif tick % 20 == 0:
            _log_event(
                "transaction_summary",
                "Payments processing normally",
                endpoint="/payments",
                payload={"payment_method": pm, "failed": failed},
            )

        time.sleep(random.uniform(0.8, 2.0))


threading.Thread(target=_simulate, daemon=True).start()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
