"""Unit tests for the monitor agent node."""

import json
from unittest.mock import AsyncMock, patch

import pytest
from langchain_core.messages import AIMessage

from agents.monitor import _parse_anomalies, monitor_node


VALID_ANOMALY = {
    "service": "api-gateway",
    "metric": "gateway_error_rate",
    "value": 0.15,
    "threshold": 0.05,
    "severity": "critical",
}


class TestParseAnomalies:
    def test_parses_fenced_json(self):
        text = f'Some text\n```json\n[{json.dumps(VALID_ANOMALY)}]\n```\nMore text'
        result = _parse_anomalies(text)
        assert len(result) == 1
        assert result[0]["service"] == "api-gateway"

    def test_parses_empty_list(self):
        text = "All good\n```json\n[]\n```"
        result = _parse_anomalies(text)
        assert result == []

    def test_returns_empty_on_no_json(self):
        result = _parse_anomalies("No JSON here.")
        assert result == []

    def test_bare_array_ignored(self):
        # Bare arrays (not in a fenced block) must be ignored — prevents
        # hallucinated metric lists from being parsed as anomalies.
        text = f'[{json.dumps(VALID_ANOMALY)}]'
        result = _parse_anomalies(text)
        assert result == []

    def test_rejects_missing_required_fields(self):
        # Entry missing 'threshold' and 'severity' should be filtered out.
        bad = {"service": "redis", "metric": "hit_ratio", "value": 0.1}
        text = f'```json\n[{json.dumps(bad)}]\n```'
        result = _parse_anomalies(text)
        assert result == []

    def test_filters_partial_entries_keeps_valid(self):
        # Mixed list: one valid, one missing fields — only valid one survives.
        bad = {"service": "redis", "metric": "hit_ratio"}
        text = f'```json\n[{json.dumps(VALID_ANOMALY)}, {json.dumps(bad)}]\n```'
        result = _parse_anomalies(text)
        assert len(result) == 1
        assert result[0]["service"] == "api-gateway"

    def test_rejects_non_list_json_block(self):
        # A JSON object (not a list) should return empty.
        text = '```json\n{"service": "redis"}\n```'
        result = _parse_anomalies(text)
        assert result == []

    def test_multiple_valid_anomalies(self):
        anomaly2 = {**VALID_ANOMALY, "service": "payment-service", "severity": "warning"}
        text = f'```json\n[{json.dumps(VALID_ANOMALY)}, {json.dumps(anomaly2)}]\n```'
        result = _parse_anomalies(text)
        assert len(result) == 2


_BASE_STATE = {
    "messages": [], "anomalies": [], "health_summary": "",
    "has_anomalies": False, "iteration": 0,
}


class TestMonitorNode:
    @pytest.mark.asyncio
    async def test_detects_anomalies(self):
        response_text = f"```json\n[{json.dumps(VALID_ANOMALY)}]\n```\nGateway error rate is elevated."

        mock_llm = AsyncMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke.return_value = AIMessage(content=response_text)

        with patch("agents.monitor.get_llm", return_value=mock_llm):
            result = await monitor_node(state=_BASE_STATE, tools=[])

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
            result = await monitor_node(state=_BASE_STATE, tools=[])

        assert result["has_anomalies"] is False
        assert result["anomalies"] == []

    @pytest.mark.asyncio
    async def test_llm_provider_passed_to_get_llm(self):
        response_text = "```json\n[]\n```\nAll healthy."

        mock_llm = AsyncMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke.return_value = AIMessage(content=response_text)

        with patch("agents.monitor.get_llm", return_value=mock_llm) as mock_get_llm:
            await monitor_node(state=_BASE_STATE, tools=[], llm_provider="ollama", llm_model="llama3.1")

        mock_get_llm.assert_called_once_with(provider="ollama", model="llama3.1")

    @pytest.mark.asyncio
    async def test_hallucinated_anomalies_without_required_fields_rejected(self):
        # Model outputs a JSON block with incomplete entries (hallucination pattern).
        bad = [{"service": "redis"}, {"metric": "cpu"}]
        response_text = f"```json\n{json.dumps(bad)}\n```\nSome summary."

        mock_llm = AsyncMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke.return_value = AIMessage(content=response_text)

        with patch("agents.monitor.get_llm", return_value=mock_llm):
            result = await monitor_node(state=_BASE_STATE, tools=[])

        assert result["has_anomalies"] is False
        assert result["anomalies"] == []
