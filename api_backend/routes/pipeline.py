"""Pipeline execution with SSE streaming."""

import asyncio
import json
import logging
import traceback
from typing import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from agents import stream_pipeline

router = APIRouter()
logger = logging.getLogger(__name__)


class PipelineRequest(BaseModel):
    llm_provider: str = "anthropic"
    llm_model: str | None = None
    api_key: str | None = Field(None, repr=False)


def _extract_text(content) -> str:
    """Normalise LangChain chunk content to a plain string."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text", ""))
            elif hasattr(block, "text"):
                parts.append(block.text)
            else:
                parts.append(str(block))
        return "".join(parts)
    return str(content)


def _to_sse(event: dict) -> str | None:
    """Convert a LangGraph event dict to a JSON SSE payload, or None to skip."""
    event_type = event.get("event", "unknown")
    name = event.get("name", "")
    node = event.get("metadata", {}).get("langgraph_node", name)

    if event_type == "on_chat_model_stream":
        chunk = event.get("data", {}).get("chunk")
        if chunk and hasattr(chunk, "content") and chunk.content:
            text = _extract_text(chunk.content)
            if text:
                return json.dumps({"type": "token", "agent": node, "content": text})

    elif event_type == "on_tool_start":
        return json.dumps({"type": "tool_start", "agent": node, "tool": name})

    elif event_type == "on_tool_end":
        output = event.get("data", {}).get("output", "")
        if isinstance(output, list):
            output = " ".join(
                b.get("text", str(b)) if isinstance(b, dict) else str(b)
                for b in output
            )
        elif not isinstance(output, str):
            output = str(output)
        if len(output) > 500:
            output = output[:500] + "..."
        return json.dumps({"type": "tool_end", "agent": node, "output": output})

    elif event_type == "on_chain_end" and node in ("monitor", "analyst", "responder"):
        output = event.get("data", {}).get("output")
        # Only fire agent_complete for the node-level on_chain_end (output is a
        # state dict). Nested chain completions (LLM/tool chains) have non-dict
        # outputs (e.g. AIMessage) — skip those to avoid AttributeError.
        if not isinstance(output, dict):
            return None
        # Only treat as the true node completion if the output contains known
        # state keys; nested chains may return dicts with unrelated keys.
        _STATE_KEYS = {"anomalies", "root_cause", "remediation_plan", "has_anomalies",
                       "health_summary", "blast_radius", "confidence"}
        if not (_STATE_KEYS & output.keys()):
            return None
        result = {k: v for k, v in output.items() if k != "messages"}
        try:
            return json.dumps({"type": "agent_complete", "agent": node, "result": result})
        except (TypeError, ValueError):
            return json.dumps({"type": "agent_complete", "agent": node, "result": {}})

    return None


def _iter_leaf_exceptions(exc: BaseException):
    """Yield deepest nested exceptions, flattening ExceptionGroup trees."""
    nested = getattr(exc, "exceptions", None)
    if nested:
        for child in nested:
            yield from _iter_leaf_exceptions(child)
        return
    yield exc


def _describe_exception(exc: BaseException) -> str:
    """Return the most actionable leaf error from nested async exception groups."""
    leaf = next(iter(_iter_leaf_exceptions(exc)), exc)

    if isinstance(leaf, KeyError) and leaf.args:
        return f"Unknown provider: {leaf.args[0]}"

    message = str(leaf).strip()
    if message:
        return message

    return leaf.__class__.__name__


async def _stream_events(req: PipelineRequest, request: Request) -> AsyncGenerator[str, None]:
    """Run pipeline in a dedicated asyncio task; relay SSE via a queue.

    The pipeline task owns all anyio cancel scopes (MCP stdio sessions) from
    start to finish — never cancelled mid-run to avoid cross-task scope errors.
    On client disconnect we stop yielding but keep draining the queue so the
    producer can finish cleanly.
    """
    queue: asyncio.Queue[str | None] = asyncio.Queue()

    async def _run() -> None:
        try:
            async for event in stream_pipeline(
                verbose=False,
                llm_provider=req.llm_provider,
                llm_model=req.llm_model,
                api_key=req.api_key,
            ):
                line = _to_sse(event)
                if line:
                    await queue.put(f"data: {line}\n\n")
        except Exception as exc:
            message = _describe_exception(exc)
            logger.error(
                "Pipeline stream failed: %s\n%s",
                message,
                "".join(traceback.format_exception(exc)),
            )
            err = json.dumps({"type": "error", "message": message})
            await queue.put(f"data: {err}\n\n")
        finally:
            await queue.put(None)  # sentinel

    task = asyncio.create_task(_run())
    disconnected = False

    try:
        while True:
            try:
                item = await asyncio.wait_for(queue.get(), timeout=1.0)
            except asyncio.TimeoutError:
                if await request.is_disconnected():
                    disconnected = True
                    logger.debug("Pipeline stream client disconnected; draining task")
                    break
                continue
            if item is None:
                break
            yield item
            if await request.is_disconnected():
                disconnected = True
                logger.debug("Pipeline stream client disconnected; draining task")
                break
    finally:
        if disconnected:
            while True:
                item = await queue.get()
                if item is None:
                    break

    await task  # wait for clean teardown — do NOT cancel

    if not disconnected:
        yield 'data: {"type": "done"}\n\n'


@router.post("/run")
async def run_pipeline_endpoint(request: Request, req: PipelineRequest = PipelineRequest()):
    return StreamingResponse(
        _stream_events(req, request),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
