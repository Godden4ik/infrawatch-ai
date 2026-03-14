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
