"""Provider registry endpoints — list providers and check connectivity."""

import os
import time
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Header
from fastapi.responses import JSONResponse

from agents.providers import PROVIDER_REGISTRY, get_llm

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")


async def _fetch_ollama_models() -> list[dict]:
    """Fetch live model list from Ollama; return [] on any failure."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
            r.raise_for_status()
            data = r.json()
            return [
                {
                    "id": m["name"],
                    "name": m["name"],
                    "param_size": m.get("details", {}).get("parameter_size", "-"),
                }
                for m in data.get("models", [])
            ]
    except Exception:
        return []


def _static_models(model_list: list[str]) -> list[dict]:
    """Transform a plain string list of model names to the API dict format."""
    return [{"id": m, "name": m, "param_size": "-"} for m in model_list]


@router.get("/list")
async def list_providers():
    """Return all providers from PROVIDER_REGISTRY with availability status."""
    providers = []
    for provider_id, entry in PROVIDER_REGISTRY.items():
        key_env = entry.get("key_env")

        if provider_id == "ollama":
            models = await _fetch_ollama_models()
            # Ollama is available if we can reach it (non-empty list or reachable)
            available = True
            try:
                async with httpx.AsyncClient() as client:
                    await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
            except Exception:
                available = False
            requires_key = False
        else:
            raw_models = entry.get("models", [])
            models = _static_models(raw_models) if isinstance(raw_models, list) else []
            available = bool(key_env and os.getenv(key_env))
            requires_key = bool(key_env)

        providers.append(
            {
                "id": provider_id,
                "name": entry["name"],
                "available": available,
                "requires_key": requires_key,
                "models": models,
                "default_model": entry["default_model"],
            }
        )

    return {"providers": providers}


@router.get("/{provider_id}/health")
async def provider_health(
    provider_id: str,
    x_provider_key: str | None = Header(None),
):
    """Lightweight connectivity check for a provider."""
    if provider_id not in PROVIDER_REGISTRY:
        return JSONResponse(
            status_code=422,
            content={"error": f"Unknown provider: {provider_id!r}", "code": "UNKNOWN_PROVIDER"},
        )

    start = time.monotonic()
    entry = PROVIDER_REGISTRY[provider_id]
    checked_at = datetime.now(timezone.utc).isoformat()

    try:
        if provider_id == "ollama":
            async with httpx.AsyncClient() as client:
                await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            return {
                "provider": provider_id,
                "status": "healthy",
                "latency_ms": latency_ms,
                "checked_at": checked_at,
            }
        else:
            key_env = entry.get("key_env")
            api_key = x_provider_key or (os.getenv(key_env) if key_env else None)
            if not api_key:
                latency_ms = round((time.monotonic() - start) * 1000, 1)
                return {
                    "provider": provider_id,
                    "status": "no_key",
                    "latency_ms": latency_ms,
                    "checked_at": checked_at,
                }

            llm = get_llm(provider=provider_id, api_key=api_key, temperature=0.0)
            await llm.ainvoke("hi")
            latency_ms = round((time.monotonic() - start) * 1000, 1)
            return {
                "provider": provider_id,
                "status": "healthy",
                "latency_ms": latency_ms,
                "checked_at": checked_at,
            }
    except Exception as exc:
        latency_ms = round((time.monotonic() - start) * 1000, 1)
        return {
            "provider": provider_id,
            "status": "unhealthy",
            "latency_ms": latency_ms,
            "checked_at": checked_at,
            "error": str(exc),
        }
