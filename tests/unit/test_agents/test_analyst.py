"""Unit tests for the analyst agent node."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from langchain_core.messages import AIMessage

from agents.analyst import _parse_analysis, analyst_node


class TestParseAnalysis:
    def test_parses_full_analysis(self):
        text = '```json\n{"root_cause": "Redis down", "confidence": 0.9, "blast_radius": [{"service": "api-gateway", "impact_level": "direct", "slo_at_risk": "latency"}]}\n```'
        result = _parse_analysis(text)
        assert result["root_cause"] == "Redis down"
        assert result["confidence"] == 0.9
        assert len(result["blast_radius"]) == 1

    def test_returns_empty_on_no_json(self):
        result = _parse_analysis("Just some analysis text.")
        assert result == {}


class TestAnalystNode:
    @pytest.mark.asyncio
    async def test_includes_log_retrieval_instruction_in_human_message(self):
        analysis = {
            "root_cause": "Third-party payment processor timeout.",
            "confidence": 0.75,
            "blast_radius": [{"service": "payment-service", "impact_level": "direct", "slo_at_risk": "latency"}],
        }
        response_text = f"```json\n{json.dumps(analysis)}\n```"

        state = {
            "messages": [],
            "anomalies": [{"service": "payment-service", "metric": "payment_failure_rate", "value": 0.2, "threshold": 0.05, "severity": "critical"}],
            "health_summary": "Payment failures elevated.",
            "iteration": 0,
        }

        with patch("agents.analyst.get_llm", return_value=object()), \
             patch("agents.analyst.run_agent_with_tools", new=AsyncMock(return_value=([], response_text))) as mock_run:
            await analyst_node(state=state, tools=[])

        kwargs = mock_run.call_args.kwargs
        assert "get_service_logs(service_name=<service>" in kwargs["human_message"]

    @pytest.mark.asyncio
    async def test_produces_analysis(self):
        analysis = {
            "root_cause": "Redis cache failure causing cascading latency",
            "confidence": 0.85,
            "blast_radius": [
                {"service": "payment-service", "impact_level": "direct", "slo_at_risk": "latency"},
                {"service": "api-gateway", "impact_level": "indirect", "slo_at_risk": "both"},
            ],
        }
        response_text = f"```json\n{json.dumps(analysis)}\n```\nDetailed analysis follows."

        mock_llm = AsyncMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke.return_value = AIMessage(content=response_text)

        state = {
            "messages": [],
            "anomalies": [{"service": "redis-cache", "metric": "cache_hit_ratio", "value": 0.3, "threshold": 0.8, "severity": "critical"}],
            "health_summary": "Cache hit ratio dropped.",
            "iteration": 0,
        }

        with patch("agents.analyst.get_llm", return_value=mock_llm):
            result = await analyst_node(state=state, tools=[])

        assert result["root_cause"] == "Redis cache failure causing cascading latency"
        assert result["confidence"] == 0.85
        assert len(result["blast_radius"]) == 2
        assert result["iteration"] == 1

    @pytest.mark.asyncio
    async def test_safe_fallback_on_invalid_schema(self):
        invalid_analysis = {
            "root_cause": 123,  # wrong type
            "confidence": 2.0,  # out of range
            "blast_radius": [
                {"service": "api-gateway", "impact_level": "unknown", "slo_at_risk": "latency"}
            ],
            "similar_incidents": "INC-1",  # wrong type
            "relevant_runbooks": "RB-1",  # wrong type
        }
        response_text = f"```json\n{json.dumps(invalid_analysis)}\n```"

        mock_llm = AsyncMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke.return_value = AIMessage(content=response_text)

        state = {
            "messages": [],
            "anomalies": [{"service": "redis-cache", "metric": "cache_hit_ratio", "value": 0.3, "threshold": 0.8, "severity": "critical"}],
            "health_summary": "Cache hit ratio dropped.",
            "iteration": 0,
        }

        with patch("agents.analyst.get_llm", return_value=mock_llm):
            result = await analyst_node(state=state, tools=[])

        assert result["root_cause"] == "Root cause could not be reliably parsed from model output."
        assert result["confidence"] == 0.0
        assert result["blast_radius"] == []
        assert result["iteration"] == 1
