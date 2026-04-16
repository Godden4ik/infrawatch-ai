"""StateGraph assembly — Monitor → Analyst → Responder with conditional edges."""

import logging
from functools import partial

from langchain_core.tools import BaseTool
from langgraph.graph import END, StateGraph

from agents.analyst import analyst_node
from agents.monitor import monitor_node
from agents.responder import responder_node
from agents.state import PipelineState

logger = logging.getLogger(__name__)


def route_after_monitor(state: PipelineState) -> str:
    """Route to analyst if anomalies found, otherwise end."""
    if state.get("has_anomalies"):
        logger.info("ROUTE monitor → analyst (%d anomaly(ies))", len(state.get("anomalies", [])))
        return "analyst"
    logger.info("ROUTE monitor → END (no anomalies)")
    return END


def route_after_analyst(state: PipelineState) -> str:
    """Route back to monitor on low confidence, otherwise to responder."""
    confidence = state.get("confidence", 1.0)
    iteration = state.get("iteration", 0)
    if confidence < 0.3 and iteration < 2:
        logger.info("ROUTE analyst → monitor (confidence %.2f < 0.3, iteration %d)", confidence, iteration)
        return "monitor"
    logger.info("ROUTE analyst → responder (confidence %.2f)", confidence)
    return "responder"


def build_graph(
    monitor_tools: list[BaseTool],
    analyst_tools: list[BaseTool],
    responder_tools: list[BaseTool],
    llm_provider: str = "anthropic",
    llm_model: str | None = None,
    api_key: str | None = None,
):
    """Build and compile the agent pipeline StateGraph."""
    graph = StateGraph(PipelineState)

    # Add nodes with tool lists, LLM provider, model, and api_key injected via partial
    graph.add_node("monitor", partial(monitor_node, tools=monitor_tools, llm_provider=llm_provider, llm_model=llm_model, api_key=api_key))
    graph.add_node("analyst", partial(analyst_node, tools=analyst_tools, llm_provider=llm_provider, llm_model=llm_model, api_key=api_key))
    graph.add_node("responder", partial(responder_node, tools=responder_tools, llm_provider=llm_provider, llm_model=llm_model, api_key=api_key))

    # Edges
    graph.set_entry_point("monitor")
    graph.add_conditional_edges("monitor", route_after_monitor, {"analyst": "analyst", END: END})
    graph.add_conditional_edges("analyst", route_after_analyst, {"responder": "responder", "monitor": "monitor"})
    graph.add_edge("responder", END)

    return graph.compile()
