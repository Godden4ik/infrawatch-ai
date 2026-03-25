"""Anomaly injection and reset routes."""

import asyncio
import os

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


_localhost = "localhost"

SERVICE_URLS = {
    "api-gateway": f"http://{os.getenv('API_GATEWAY_HOST', _localhost)}:8000",
    "payment-service": f"http://{os.getenv('PAYMENT_SERVICE_HOST', _localhost)}:8001",
    "user-service": f"http://{os.getenv('USER_SERVICE_HOST', _localhost)}:8002",
    "order-service": f"http://{os.getenv('ORDER_SERVICE_HOST', _localhost)}:8003",
    "redis-cache": f"http://{os.getenv('REDIS_CACHE_HOST', _localhost)}:8004",
}

SCENARIOS = {
    "cascade": [
        ("redis-cache", "cache_failure"),
        ("payment-service", "cache_degraded"),
        ("order-service", "cache_degraded"),
    ],
}


class InjectRequest(BaseModel):
    service: str
    anomaly_type: str


@router.post("/inject")
async def inject_anomaly(req: InjectRequest):
    base_url = SERVICE_URLS.get(req.service)
    if not base_url:
        return {"error": f"Unknown service: {req.service}"}
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"{base_url}/inject",
            params={"anomaly_type": req.anomaly_type},
            timeout=5.0,
        )
        return r.json()


@router.post("/inject-scenario/{scenario}")
async def inject_scenario(scenario: str):
    injections = SCENARIOS.get(scenario)
    if not injections:
        return {"error": f"Unknown scenario: {scenario}"}
    async with httpx.AsyncClient() as client:
        tasks = [
            client.post(
                f"{SERVICE_URLS[svc]}/inject",
                params={"anomaly_type": atype},
                timeout=5.0,
            )
            for svc, atype in injections
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    return {
        "scenario": scenario,
        "results": [
            r.json() if not isinstance(r, Exception) else str(r) for r in results
        ],
    }


@router.post("/reset")
async def reset_anomalies():
    async with httpx.AsyncClient() as client:
        tasks = [
            client.post(
                f"{base_url}/inject",
                params={"anomaly_type": "none"},
                timeout=5.0,
            )
            for base_url in SERVICE_URLS.values()
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
    return {"status": "reset"}
