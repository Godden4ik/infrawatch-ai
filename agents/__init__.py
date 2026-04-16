"""InfraWatch AI agent pipeline — Monitor → Analyst → Responder."""

import asyncio

from agents.config import setup_logging, MCP_SERVERS
from agents.graph import build_graph
from agents.tools import ANALYST_TOOLS, MONITOR_TOOLS, RESPONDER_TOOLS, create_mcp_client, filter_tools, load_all_tools
from langchain_mcp_adapters.tools import load_mcp_tools


async def run_pipeline(verbose: bool = True, llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None) -> dict:
    """Run the full agent pipeline with persistent MCP server sessions.

    Opens one session per MCP server and keeps it alive for the full pipeline,
    so the Neo4j server (and its SentenceTransformer model) is loaded only once.

    llm_provider: "anthropic" (default) or "ollama"
    """
    if verbose:
        import logging
        setup_logging(logging.INFO)

    client = create_mcp_client()

    # Open all three MCP server sessions simultaneously and hold them open
    # for the duration of the pipeline run.
    async with (
        client.session("prometheus") as prom_session,
        client.session("grafana") as graf_session,
        client.session("neo4j") as neo4j_session,
    ):
        prom_tools = await load_mcp_tools(prom_session)
        graf_tools = await load_mcp_tools(graf_session)
        neo4j_tools = await load_mcp_tools(neo4j_session)
        all_tools = prom_tools + graf_tools + neo4j_tools

        compiled = build_graph(
            monitor_tools=filter_tools(all_tools, MONITOR_TOOLS),
            analyst_tools=filter_tools(all_tools, ANALYST_TOOLS),
            responder_tools=filter_tools(all_tools, RESPONDER_TOOLS),
            llm_provider=llm_provider,
            llm_model=llm_model,
            api_key=api_key,
        )

        initial_state = {
            "messages": [],
            "anomalies": [],
            "health_summary": "",
            "root_cause": "",
            "blast_radius": [],
            "confidence": 0.0,
            "remediation_plan": "",
            "relevant_runbooks": [],
            "similar_incidents": [],
            "has_anomalies": False,
            "iteration": 0,
        }

        return await compiled.ainvoke(initial_state)


async def stream_pipeline(verbose: bool = False, llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None):
    """Async generator yielding LangGraph astream_events for the pipeline.

    All anyio cancel scopes (MCP stdio sessions) are confined to a single
    dedicated asyncio Task so they are never entered/exited across task
    boundaries — avoiding the anyio "exit cancel scope in different task" error.

    llm_provider: "anthropic" (default) or "ollama"
    """
    if verbose:
        import logging
        setup_logging(logging.INFO)

    _sentinel = object()
    queue: asyncio.Queue = asyncio.Queue()

    async def _run() -> None:
        """Own all anyio cancel scopes from open to close in one task."""
        try:
            client = create_mcp_client()
            async with (
                client.session("prometheus") as prom_session,
                client.session("grafana") as graf_session,
                client.session("neo4j") as neo4j_session,
            ):
                prom_tools = await load_mcp_tools(prom_session)
                graf_tools = await load_mcp_tools(graf_session)
                neo4j_tools = await load_mcp_tools(neo4j_session)
                all_tools = prom_tools + graf_tools + neo4j_tools

                compiled = build_graph(
                    monitor_tools=filter_tools(all_tools, MONITOR_TOOLS),
                    analyst_tools=filter_tools(all_tools, ANALYST_TOOLS),
                    responder_tools=filter_tools(all_tools, RESPONDER_TOOLS),
                    llm_provider=llm_provider,
                    llm_model=llm_model,
                    api_key=api_key,
                )

                initial_state = {
                    "messages": [],
                    "anomalies": [],
                    "health_summary": "",
                    "root_cause": "",
                    "blast_radius": [],
                    "confidence": 0.0,
                    "remediation_plan": "",
                    "relevant_runbooks": [],
                    "similar_incidents": [],
                    "has_anomalies": False,
                    "iteration": 0,
                }

                async for event in compiled.astream_events(initial_state, version="v2"):
                    await queue.put(event)
        except Exception as exc:
            await queue.put(exc)
        finally:
            await queue.put(_sentinel)

    task = asyncio.create_task(_run())

    while True:
        item = await queue.get()
        if item is _sentinel:
            break
        if isinstance(item, Exception):
            raise item
        yield item

    await task  # propagate any task-level exception; never cancels
