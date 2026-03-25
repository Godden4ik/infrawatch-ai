"""Pipeline state definition for the agent graph."""

from typing import Annotated, TypedDict

from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages


class PipelineState(TypedDict):
    """Shared state flowing through the Monitor → Analyst → Responder pipeline."""

    messages: Annotated[list[BaseMessage], add_messages]
    anomalies: list[dict]  # [{service, metric, value, threshold, severity}]
    health_summary: str
    root_cause: str
    blast_radius: list[dict]  # [{service, impact_level, slo_at_risk}]
    confidence: float  # 0.0–1.0
    remediation_plan: str
    relevant_runbooks: list[dict]  # GraphRAG runbook search results
    similar_incidents: list[dict]  # Historical incident matches
    has_anomalies: bool
    iteration: int  # loop guard (max 2)
