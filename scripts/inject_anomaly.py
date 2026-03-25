"""Anomaly injection CLI for InfraWatch services.

Usage:
    python scripts/inject_anomaly.py latency payment-service order-service
    python scripts/inject_anomaly.py error api-gateway
    python scripts/inject_anomaly.py memory_leak redis-cache
    python scripts/inject_anomaly.py cascade           # redis down → payment, user, order degrade
    python scripts/inject_anomaly.py reset              # clear all anomalies
"""

import sys
import urllib.request
import urllib.error
import json

SERVICE_PORTS = {
    "api-gateway": 8080,
    "payment-service": 8001,
    "user-service": 8002,
    "order-service": 8003,
    "redis-cache": 8004,
}

BASE_URL = "http://localhost"


def inject(service: str, anomaly_type: str | None) -> str:
    port = SERVICE_PORTS[service]
    param = f"?anomaly_type={anomaly_type}" if anomaly_type else "?anomaly_type=none"
    url = f"{BASE_URL}:{port}/inject{param}"
    req = urllib.request.Request(url, method="POST")
    try:
        resp = urllib.request.urlopen(req)
        return json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        return {"error": str(e), "service": service}


def reset_all():
    print("Resetting all services...")
    for svc in SERVICE_PORTS:
        result = inject(svc, None)
        print(f"  {svc}: {result}")


def inject_cascade():
    """Simulate Redis cache failure cascading to payment and order services.

    Signal chain visible in Prometheus:
      redis_cache_hit_ratio            → 0.05  (cache effectively down)
      payment_processing_duration p95  → ~7s   (DB fallback)
      order_processing_duration p95    → ~7s   (DB fallback)

    The dependency graph confirms both services DEPENDS_ON redis-cache,
    making root cause unambiguous for the analyst agent.
    """
    print("Injecting cascade: Redis cache failure → payment + order DB fallback\n")

    print("1. redis-cache      — cache_failure    (hit ratio → 0.05)")
    print(f"   {inject('redis-cache', 'cache_failure')}")

    print("2. payment-service  — cache_degraded   (DB fallback latency +3–7s)")
    print(f"   {inject('payment-service', 'cache_degraded')}")

    print("3. order-service    — cache_degraded   (DB fallback latency +3–7s)")
    print(f"   {inject('order-service', 'cache_degraded')}")

    print("\nWait ~60s for Prometheus to scrape the new values, then run the pipeline.")


SCENARIOS = {
    "cascade": inject_cascade,
    "reset": reset_all,
}


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    anomaly_type = sys.argv[1]

    # Named scenarios
    if anomaly_type in SCENARIOS:
        SCENARIOS[anomaly_type]()
        return

    # Direct injection: <type> <service1> [service2 ...]
    targets = sys.argv[2:] if len(sys.argv) > 2 else list(SERVICE_PORTS.keys())

    for svc in targets:
        if svc not in SERVICE_PORTS:
            print(f"Unknown service: {svc} (available: {', '.join(SERVICE_PORTS)})")
            continue
        result = inject(svc, anomaly_type)
        print(f"{svc}: {result}")


if __name__ == "__main__":
    main()
