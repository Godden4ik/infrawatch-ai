"""Aggregated health check for all InfraWatch services."""

import asyncio
import os

import httpx
from fastapi import APIRouter

router = APIRouter()


def _get_service_urls() -> dict[str, str]:
    localhost = "localhost"
    return {
        "api-gateway": f"http://{os.getenv('API_GATEWAY_HOST', localhost)}:8000/health",
        "payment-service": f"http://{os.getenv('PAYMENT_SERVICE_HOST', localhost)}:8001/health",
        "user-service": f"http://{os.getenv('USER_SERVICE_HOST', localhost)}:8002/health",
        "order-service": f"http://{os.getenv('ORDER_SERVICE_HOST', localhost)}:8003/health",
        "redis-cache": f"http://{os.getenv('REDIS_CACHE_HOST', localhost)}:8004/health",
        "prometheus": os.getenv("PROMETHEUS_URL", f"http://{localhost}:9090") + "/-/ready",
        "neo4j": f"http://{os.getenv('NEO4J_HOST', localhost)}:7474",
    }


async def _check(client: httpx.AsyncClient, name: str, url: str) -> dict:
    try:
        r = await client.get(url, timeout=3.0)
        return {"service": name, "status": "healthy" if r.status_code < 400 else "unhealthy"}
    except Exception:
        return {"service": name, "status": "unreachable"}


@router.get("/health")
async def health():
    async with httpx.AsyncClient() as client:
        urls = _get_service_urls()
        results = await asyncio.gather(
            *[_check(client, name, url) for name, url in urls.items()]
        )
    status_map = {r["service"]: r["status"] for r in results}
    all_healthy = all(s == "healthy" for s in status_map.values())
    return {"status": "healthy" if all_healthy else "degraded", "services": status_map}
