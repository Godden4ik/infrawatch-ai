"""InfraWatch AI agent pipeline — Monitor → Analyst → Responder."""

from agents.graph import build_graph
from agents.tools import ANALYST_TOOLS, MONITOR_TOOLS, RESPONDER_TOOLS, create_mcp_client, filter_tools, load_all_tools


async def run_pipeline() -> dict:
    """Run the full agent pipeline with live MCP servers.

    Creates an MCP client, loads all tools, builds the graph, and invokes it.
    Returns the final PipelineState dict.
    """
    client = create_mcp_client()
    all_tools = await load_all_tools(client)

    compiled = build_graph(
        monitor_tools=filter_tools(all_tools, MONITOR_TOOLS),
        analyst_tools=filter_tools(all_tools, ANALYST_TOOLS),
        responder_tools=filter_tools(all_tools, RESPONDER_TOOLS),
    )

    initial_state = {
        "messages": [],
        "anomalies": [],
        "health_summary": "",
        "root_cause": "",
        "blast_radius": [],
        "confidence": 0.0,
        "remediation_plan": "",
        "has_anomalies": False,
        "iteration": 0,
    }

    return await compiled.ainvoke(initial_state)
