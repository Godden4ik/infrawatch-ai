"""StateGraph assembly — Monitor → Analyst → Responder with conditional edges."""

from functools import partial

from langchain_core.tools import BaseTool
from langgraph.graph import END, StateGraph

from agents.analyst import analyst_node
from agents.monitor import monitor_node
from agents.responder import responder_node
from agents.state import PipelineState


def route_after_monitor(state: PipelineState) -> str:
    """Route to analyst if anomalies found, otherwise end."""
    return "analyst" if state.get("has_anomalies") else END


def route_after_analyst(state: PipelineState) -> str:
    """Route back to monitor on low confidence, otherwise to responder."""
    if state.get("confidence", 1.0) < 0.3 and state.get("iteration", 0) < 2:
        return "monitor"
    return "responder"


def build_graph(
    monitor_tools: list[BaseTool],
    analyst_tools: list[BaseTool],
    responder_tools: list[BaseTool],
):
    """Build and compile the agent pipeline StateGraph."""
    graph = StateGraph(PipelineState)

    # Add nodes with tool lists injected via partial
    graph.add_node("monitor", partial(monitor_node, tools=monitor_tools))
    graph.add_node("analyst", partial(analyst_node, tools=analyst_tools))
    graph.add_node("responder", partial(responder_node, tools=responder_tools))

    # Edges
    graph.set_entry_point("monitor")
    graph.add_conditional_edges("monitor", route_after_monitor, {"analyst": "analyst", END: END})
    graph.add_conditional_edges("analyst", route_after_analyst, {"responder": "responder", "monitor": "monitor"})
    graph.add_edge("responder", END)

    return graph.compile()
