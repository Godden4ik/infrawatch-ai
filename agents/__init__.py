"""InfraWatch AI agent pipeline — Monitor → Analyst → Responder."""

from agents.config import setup_logging, MCP_SERVERS
from agents.graph import build_graph
from agents.tools import ANALYST_TOOLS, MONITOR_TOOLS, RESPONDER_TOOLS, create_mcp_client, filter_tools, load_all_tools
from langchain_mcp_adapters.tools import load_mcp_tools


async def run_pipeline(verbose: bool = True) -> dict:
    """Run the full agent pipeline with persistent MCP server sessions.

    Opens one session per MCP server and keeps it alive for the full pipeline,
    so the Neo4j server (and its SentenceTransformer model) is loaded only once.
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
