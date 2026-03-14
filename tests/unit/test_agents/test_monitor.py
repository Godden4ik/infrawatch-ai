"""Unit tests for the monitor agent node."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from langchain_core.messages import AIMessage

from agents.monitor import _parse_anomalies, monitor_node


class TestParseAnomalies:
    def test_parses_fenced_json(self):
        text = 'Some text\n```json\n[{"service": "gw", "metric": "err", "value": 0.1, "threshold": 0.05, "severity": "critical"}]\n```\nMore text'
        result = _parse_anomalies(text)
        assert len(result) == 1
        assert result[0]["service"] == "gw"

    def test_parses_empty_list(self):
        text = "All good\n```json\n[]\n```"
        result = _parse_anomalies(text)
        assert result == []

    def test_returns_empty_on_no_json(self):
        result = _parse_anomalies("No JSON here.")
        assert result == []

    def test_parses_bare_array(self):
        text = '[{"service": "redis"}]'
        result = _parse_anomalies(text)
        assert len(result) == 1


class TestMonitorNode:
    @pytest.mark.asyncio
    async def test_detects_anomalies(self):
        anomalies = [{"service": "api-gateway", "metric": "gateway_error_rate", "value": 0.15, "threshold": 0.05, "severity": "critical"}]
        response_text = f"```json\n{json.dumps(anomalies)}\n```\nGateway error rate is elevated."

        mock_llm = AsyncMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke.return_value = AIMessage(content=response_text)

        with patch("agents.monitor.get_llm", return_value=mock_llm):
            result = await monitor_node(
                state={"messages": [], "anomalies": [], "health_summary": "", "has_anomalies": False, "iteration": 0},
                tools=[],
            )

        assert result["has_anomalies"] is True
        assert len(result["anomalies"]) == 1
        assert result["anomalies"][0]["service"] == "api-gateway"
        assert "Gateway error rate" in result["health_summary"]

    @pytest.mark.asyncio
    async def test_no_anomalies(self):
        response_text = "```json\n[]\n```\nAll services healthy."

        mock_llm = AsyncMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke.return_value = AIMessage(content=response_text)

        with patch("agents.monitor.get_llm", return_value=mock_llm):
            result = await monitor_node(
                state={"messages": [], "anomalies": [], "health_summary": "", "has_anomalies": False, "iteration": 0},
                tools=[],
            )

        assert result["has_anomalies"] is False
        assert result["anomalies"] == []
