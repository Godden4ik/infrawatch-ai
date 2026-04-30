"""Redis Cache simulator — cache hit/miss and memory metrics."""

import json
import logging
import random
import threading
import time
from collections import deque
from datetime import UTC, datetime

from fastapi import FastAPI
from prometheus_client import Counter, Gauge, generate_latest
from starlette.responses import Response

app = FastAPI(title="redis-cache")
logger = logging.getLogger("redis-cache")
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
        "service": "redis-cache",
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
CACHE_HITS = Counter("redis_cache_hits_total", "Total cache hits")
CACHE_MISSES = Counter("redis_cache_misses_total", "Total cache misses")
HIT_RATIO = Gauge("redis_cache_hit_ratio", "Current cache hit ratio (0-1)")
MEMORY_USED = Gauge("redis_memory_used_bytes", "Memory used by Redis in bytes")
MEMORY_MAX = Gauge("redis_memory_max_bytes", "Max configured memory")
CONNECTIONS = Gauge("redis_connected_clients", "Number of connected clients")
EVICTED_KEYS = Counter("redis_evicted_keys_total", "Total evicted keys")
KEYS_COUNT = Gauge("redis_keys_total", "Total keys stored")

# Set max memory to 512 MB
MEMORY_MAX.set(512 * 1024 * 1024)

# --- Anomaly injection state ---
anomaly = {"enabled": False, "type": None}


@app.get("/health")
def health():
    return {"status": "healthy", "service": "redis-cache"}


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
    return {"service": "redis-cache", "level": level_upper, "entries": entries[-capped_limit:], "truncated": len(entries) > capped_limit}


# --- Background traffic simulator ---
def _simulate():
    mem_bytes = 180 * 1024 * 1024  # start at ~180 MB
    keys = 45000
    tick = 0
    while True:
        tick += 1
        # Cache operations
        is_hit = random.random() < 0.92  # 92% hit ratio normally

        if anomaly["enabled"]:
            if anomaly["type"] == "cache_failure":
                is_hit = random.random() < 0.05  # 95% misses — cache effectively down
            elif anomaly["type"] == "error":
                is_hit = random.random() < 0.40

        if is_hit:
            CACHE_HITS.inc()
        else:
            CACHE_MISSES.inc()

        if anomaly["enabled"] and anomaly["type"] == "cache_failure":
            HIT_RATIO.set(0.05)
        elif anomaly["enabled"] and anomaly["type"] == "error":
            HIT_RATIO.set(0.40)
        else:
            HIT_RATIO.set(0.92)

        # Memory simulation
        if anomaly["enabled"] and anomaly["type"] == "memory_leak":
            mem_bytes += random.randint(500_000, 2_000_000)  # ~0.5-2 MB/tick
            keys += random.randint(50, 200)
        else:
            mem_bytes += random.randint(-200_000, 300_000)
            keys += random.randint(-10, 15)

        mem_bytes = max(100 * 1024 * 1024, min(mem_bytes, 510 * 1024 * 1024))
        keys = max(10000, min(keys, 500000))

        MEMORY_USED.set(mem_bytes)
        KEYS_COUNT.set(keys)
        CONNECTIONS.set(random.randint(5, 40))

        # Evictions when memory is high
        if mem_bytes > 450 * 1024 * 1024:
            EVICTED_KEYS.inc(random.randint(10, 100))
            _log_event(
                "eviction_spike",
                "Redis evictions increased due to high memory pressure",
                endpoint="/cache",
                error_code="REDIS_EVICTION_SPIKE",
                payload={"memory_used_bytes": mem_bytes, "keys": keys},
            )

        if anomaly["enabled"] and anomaly["type"] in {"cache_failure", "memory_leak"}:
            _log_event(
                "cache_degraded",
                "Redis cache health degraded",
                endpoint="/cache",
                error_code="CACHE_DEGRADED",
                payload={"hit_ratio": 0.05 if anomaly["type"] == "cache_failure" else 0.40, "memory_used_bytes": mem_bytes},
            )
        elif tick % 20 == 0:
            _log_event(
                "cache_summary",
                "Redis cache operating in normal range",
                endpoint="/cache",
                payload={"memory_used_bytes": mem_bytes, "keys": keys},
            )

        time.sleep(random.uniform(0.5, 1.5))


threading.Thread(target=_simulate, daemon=True).start()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8004)
