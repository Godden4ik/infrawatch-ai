"""User Service — authentication and session management."""

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

app = FastAPI(title="user-service")
logger = logging.getLogger("user-service")
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
        "service": "user-service",
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
MEMORY_USED = Gauge("user_memory_used_bytes", "Memory used by user-service in bytes")
MEMORY_MAX = Gauge("user_memory_max_bytes", "Max configured memory for user-service")
MEMORY_MAX.set(512 * 1024 * 1024)
MEMORY_USED.set(80 * 1024 * 1024)

# --- Anomaly injection state ---
anomaly = {"enabled": False, "type": None, "since": None}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "user-service"}


@app.get("/state")
def state():
    return {
        "service": "user-service",
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
    return {"service": "user-service", "level": level_upper, "entries": entries[-capped_limit:], "truncated": len(entries) > capped_limit}


# --- Background traffic simulator ---
def _simulate():
    sessions = 200
    endpoints = ["/login", "/register", "/profile", "/logout"]
    tick = 0
    mem_bytes = 80 * 1024 * 1024
    mem_baseline = mem_bytes
    while True:
        tick += 1
        ep = random.choice(endpoints)

        resp_time = random.uniform(0.005, 0.06)
        if anomaly["enabled"] and anomaly["type"] == "latency":
            resp_time += random.uniform(0.3, 1.5)
        if anomaly["enabled"] and anomaly["type"] == "memory_leak":
            resp_time += random.uniform(0.05, 0.25)

        RESPONSE_TIME.labels(endpoint=ep).observe(resp_time)

        if anomaly["enabled"] and anomaly["type"] == "memory_leak":
            mem_bytes = min(mem_bytes + random.randint(2 * 1024 * 1024, 6 * 1024 * 1024), 512 * 1024 * 1024)
        else:
            drift = random.randint(-512 * 1024, 512 * 1024)
            mem_bytes = max(mem_baseline, min(mem_bytes + drift, mem_baseline + 8 * 1024 * 1024))
        MEMORY_USED.set(mem_bytes)

        if anomaly["enabled"] and anomaly["type"] == "memory_leak" and tick % 10 == 0:
            _log_event(
                "memory_pressure",
                "Heap usage growing without release; suspected memory leak",
                severity="WARNING",
                endpoint=ep,
                error_code="MEMORY_LEAK",
                payload={"memory_used_bytes": mem_bytes, "sessions": sessions},
            )

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
                _log_event(
                    "auth_failure",
                    "User authentication failed",
                    endpoint="/login",
                    error_code="AUTH_FAILURE",
                    payload={"result": result, "endpoint": ep},
                )

        if ep == "/register":
            REGISTRATIONS.inc()
            sessions += 1

        if ep == "/logout":
            sessions = max(0, sessions - 1)

        # Natural session drift
        sessions += random.randint(-2, 2)
        sessions = max(0, min(sessions, 5000))
        SESSION_COUNT.set(sessions)

        if tick % 25 == 0:
            _log_event(
                "session_summary",
                "Session metrics updated",
                endpoint=ep,
                payload={"sessions": sessions, "response_seconds": round(resp_time, 4)},
            )

        time.sleep(random.uniform(0.5, 1.5))


threading.Thread(target=_simulate, daemon=True).start()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8002)
