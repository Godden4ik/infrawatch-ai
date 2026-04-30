"""Evaluation routes for accuracy benchmarking."""

import asyncio
import json
import logging
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from scripts.benchmark_accuracy import run_benchmark

router = APIRouter()
logger = logging.getLogger(__name__)


class EvaluationRequest(BaseModel):
    llm_provider: str = "anthropic"
    llm_model: str | None = None
    api_key: str | None = Field(None, repr=False)


async def _stream_benchmark(req: EvaluationRequest) -> AsyncGenerator[str, None]:
    """Run accuracy benchmark and relay logs/results via SSE."""
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def log_callback(msg: str):
        await queue.put(json.dumps({"type": "log", "message": msg}))

    async def _run() -> None:
        try:
            results = await run_benchmark(
                llm_provider=req.llm_provider,
                llm_model=req.llm_model,
                api_key=req.api_key,
                log_callback=log_callback
            )
            await queue.put(json.dumps({"type": "complete", "results": results}))
        except Exception as exc:
            logger.error("Benchmark failed: %s", exc, exc_info=True)
            await queue.put(json.dumps({"type": "error", "message": str(exc)}))
        finally:
            await queue.put(None)  # sentinel

    task = asyncio.create_task(_run())

    while True:
        item = await queue.get()
        if item is None:
            break
        yield f"data: {item}\n\n"

    await task


@router.post("/run")
async def run_evaluation_endpoint(req: EvaluationRequest = EvaluationRequest()):
    return StreamingResponse(
        _stream_benchmark(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
