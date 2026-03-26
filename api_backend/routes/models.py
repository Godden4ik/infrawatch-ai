"""Ollama model listing endpoint."""

import os

import httpx
from fastapi import APIRouter

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")


@router.get("/list")
async def list_models():
    """Return locally available Ollama models."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
            r.raise_for_status()
            data = r.json()
            models = [
                {
                    "name": m["name"],
                    "size": m.get("size", 0),
                    "parameter_size": m.get("details", {}).get("parameter_size", ""),
                    "family": m.get("details", {}).get("family", ""),
                    "quantization": m.get("details", {}).get("quantization_level", ""),
                }
                for m in data.get("models", [])
            ]
            return {"status": "ok", "models": models}
    except Exception as exc:
        return {"status": "unavailable", "models": [], "error": str(exc)}
