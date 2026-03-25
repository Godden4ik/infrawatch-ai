"""Payment Service — processes transactions."""

import random
import threading
import time

from fastapi import FastAPI
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from starlette.responses import Response

app = FastAPI(title="payment-service")

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
        return {"anomaly": "disabled"}
    anomaly["enabled"] = True
    anomaly["type"] = anomaly_type
    return {"anomaly": anomaly_type, "status": "enabled"}


@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type="text/plain")


# --- Background traffic simulator ---
def _simulate():
    methods = ["credit_card", "debit_card", "bank_transfer", "crypto"]
    while True:
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

        time.sleep(random.uniform(0.8, 2.0))


threading.Thread(target=_simulate, daemon=True).start()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8001)
