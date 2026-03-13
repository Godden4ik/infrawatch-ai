"""Order Service — order processing and fulfilment."""

import random
import threading
import time

from fastapi import FastAPI
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from starlette.responses import Response

app = FastAPI(title="order-service")

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
anomaly = {"enabled": False, "type": None}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "order-service"}


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
    queue = 5
    while True:
        proc_time = random.uniform(0.2, 1.5)
        failed = random.random() < 0.02  # 2% base error

        if anomaly["enabled"]:
            if anomaly["type"] == "latency":
                proc_time += random.uniform(3.0, 10.0)
            elif anomaly["type"] == "error":
                failed = random.random() < 0.30

        ORDER_PROCESSING_TIME.observe(proc_time)

        if failed:
            ORDER_THROUGHPUT.labels(status="failed").inc()
            err_type = random.choice(["validation", "timeout", "dependency"])
            ORDER_ERRORS.labels(error_type=err_type).inc()
        else:
            status = random.choices(["completed", "cancelled"], weights=[95, 5])[0]
            ORDER_THROUGHPUT.labels(status=status).inc()

        # Queue drift
        queue += random.randint(-2, 3)
        if anomaly["enabled"] and anomaly["type"] == "latency":
            queue += random.randint(2, 8)
        queue = max(0, min(queue, 200))
        QUEUE_DEPTH.set(queue)

        time.sleep(random.uniform(0.8, 2.0))


threading.Thread(target=_simulate, daemon=True).start()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8003)
