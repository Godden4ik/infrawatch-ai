"""MCP → LangChain tool bridge and per-agent tool filtering."""

from langchain_core.tools import BaseTool
from langchain_mcp_adapters.client import MultiServerMCPClient

from agents.config import MCP_SERVERS

# Tool-name sets per agent role
MONITOR_TOOLS = {"execute_promql", "list_metrics", "get_targets", "list_alerts", "get_panel"}
ANALYST_TOOLS = {
    "run_cypher", "get_service_dependencies", "get_blast_radius",
    "search_runbooks", "find_similar_incidents",
}
RESPONDER_TOOLS = {
    "get_blast_radius", "get_service_dependencies",
    "get_runbook_for_service", "search_runbooks",
}


def create_mcp_client() -> MultiServerMCPClient:
    """Create a MultiServerMCPClient for all MCP servers."""
    return MultiServerMCPClient(MCP_SERVERS)


async def load_all_tools(client: MultiServerMCPClient) -> list[BaseTool]:
    """Fetch all tools from all MCP servers (async, no context manager needed)."""
    return await client.get_tools()


def filter_tools(all_tools: list[BaseTool], names: set[str]) -> list[BaseTool]:
    """Return the subset of tools whose names are in the given set."""
    return [t for t in all_tools if t.name in names]
