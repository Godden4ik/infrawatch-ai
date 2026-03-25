"""Integration test — verify MCP tool loading via MultiServerMCPClient.

Requires: docker compose up (Prometheus, Grafana, Neo4j, services).
"""

import pytest

from agents.tools import (
    ANALYST_TOOLS,
    MONITOR_TOOLS,
    RESPONDER_TOOLS,
    create_mcp_client,
)


@pytest.mark.asyncio
async def test_mcp_client_loads_all_tools():
    """All 10 expected tools load from the 3 MCP servers."""
    async with create_mcp_client() as client:
        tools = client.get_tools()
        tool_names = {t.name for t in tools}

        expected = MONITOR_TOOLS | ANALYST_TOOLS | RESPONDER_TOOLS
        assert expected.issubset(tool_names), f"Missing tools: {expected - tool_names}"


@pytest.mark.asyncio
async def test_prometheus_tool_callable():
    """Sanity-check: call list_metrics and verify it returns data."""
    async with create_mcp_client() as client:
        tools = client.get_tools()
        list_metrics = next(t for t in tools if t.name == "list_metrics")

        result = await list_metrics.ainvoke({})
        assert isinstance(result, str)
        assert "gateway" in result.lower() or "error" not in result.lower()
