"""Integration test — verify MCP tool loading via MultiServerMCPClient.

Requires: docker compose up (Prometheus, Grafana, Neo4j, services).
"""

import pytest

from agents.tools import (
    ANALYST_TOOLS,
    MONITOR_TOOLS,
    RESPONDER_TOOLS,
    create_mcp_client,
    load_all_tools,
)


@pytest.mark.asyncio
async def test_mcp_client_loads_all_tools():
    """All expected tools load from the 3 MCP servers (including GraphRAG tools)."""
    client = create_mcp_client()
    tools = await load_all_tools(client)
    tool_names = {t.name for t in tools}

    expected = MONITOR_TOOLS | ANALYST_TOOLS | RESPONDER_TOOLS
    assert expected.issubset(tool_names), f"Missing tools: {expected - tool_names}"


@pytest.mark.asyncio
async def test_graphrag_tools_are_loaded():
    """Verify the 4 new GraphRAG tools are available."""
    client = create_mcp_client()
    tools = await load_all_tools(client)
    tool_names = {t.name for t in tools}

    graphrag_tools = {"search_runbooks", "find_similar_incidents", "get_runbook_for_service", "search_knowledge_base"}
    assert graphrag_tools.issubset(tool_names), f"Missing GraphRAG tools: {graphrag_tools - tool_names}"


@pytest.mark.asyncio
async def test_prometheus_tool_callable():
    """Sanity-check: call list_metrics and verify it returns data."""
    client = create_mcp_client()
    tools = await load_all_tools(client)
    list_metrics = next(t for t in tools if t.name == "list_metrics")

    result = await list_metrics.ainvoke({})
    # Tool may return a plain string or a list of content blocks
    if isinstance(result, list):
        text = " ".join(block.get("text", "") if isinstance(block, dict) else str(block) for block in result)
    else:
        text = result
    assert isinstance(text, str) and len(text) > 0
    assert "gateway" in text.lower()
