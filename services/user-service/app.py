"""User Service — authentication and session management."""

import random
import threading
import time

from fastapi import FastAPI
from prometheus_client import Counter, Gauge, Histogram, generate_latest
from starlette.responses import Response

app = FastAPI(title="user-service")

# --- Prometheus metrics ---
AUTH_ATTEMPTS = Counter(
    "user_auth_attempts_total",
    "Total authentication attempts",
    ["result"],  # success / failure / blocked
)
SESSION_COUNT = Gauge("user_active_sessions", "Currently active user sessions")
RESPONSE_TIME = Histogram(
    "user_request_duration_seconds",
    "Response time for user-service requests",
    ["endpoint"],
    buckets=[0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
)
REGISTRATIONS = Counter("user_registrations_total", "New user registrations")

# --- Anomaly injection state ---
anomaly = {"enabled": False, "type": None}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "user-service"}


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
    sessions = 200
    endpoints = ["/login", "/register", "/profile", "/logout"]
    while True:
        ep = random.choice(endpoints)

        resp_time = random.uniform(0.005, 0.06)
        if anomaly["enabled"] and anomaly["type"] == "latency":
            resp_time += random.uniform(0.3, 1.5)

        RESPONSE_TIME.labels(endpoint=ep).observe(resp_time)

        # Auth simulation
        if ep == "/login":
            if anomaly["enabled"] and anomaly["type"] == "error":
                result = random.choices(
                    ["success", "failure", "blocked"], weights=[30, 50, 20]
                )[0]
            else:
                result = random.choices(
                    ["success", "failure", "blocked"], weights=[90, 8, 2]
                )[0]
            AUTH_ATTEMPTS.labels(result=result).inc()
            if result == "success":
                sessions += 1
            elif result == "failure":
                sessions = max(0, sessions - 1)

        if ep == "/register":
            REGISTRATIONS.inc()
            sessions += 1

        if ep == "/logout":
            sessions = max(0, sessions - 1)

        # Natural session drift
        sessions += random.randint(-2, 2)
        sessions = max(0, min(sessions, 5000))
        SESSION_COUNT.set(sessions)

        time.sleep(random.uniform(0.5, 1.5))


threading.Thread(target=_simulate, daemon=True).start()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)
