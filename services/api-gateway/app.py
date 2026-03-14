"""API Gateway — routes requests to downstream services."""

import random
import threading
import time

from fastapi import FastAPI, Response
from prometheus_client import Counter, Gauge, Histogram, generate_latest

app = FastAPI(title="api-gateway")

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
        return {"anomaly": "disabled"}
    anomaly["enabled"] = True
    anomaly["type"] = anomaly_type
    return {"anomaly": anomaly_type, "status": "enabled"}


@app.get("/metrics")
def metrics():
    return Response(content=generate_latest(), media_type="text/plain")


# --- Background traffic simulator ---
def _simulate():
    endpoints = ["/api/orders", "/api/users", "/api/payments", "/api/health"]
    while True:
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

        time.sleep(random.uniform(0.5, 1.5))


threading.Thread(target=_simulate, daemon=True).start()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
