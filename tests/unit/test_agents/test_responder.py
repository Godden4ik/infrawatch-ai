"""Unit tests for the responder agent node."""

from unittest.mock import AsyncMock, patch

import pytest
from langchain_core.messages import AIMessage

from agents.responder import responder_node


class TestResponderNode:
    @pytest.mark.asyncio
    async def test_produces_remediation_plan(self):
        response_text = (
            "## Remediation Plan\n\n"
            "### Immediate Actions\n"
            "1. Restart redis-cache pod\n"
            "2. Scale payment-service replicas to 3\n\n"
            "### Affected Teams\n"
            "- Platform team (redis-cache)\n"
            "- Payments team (payment-service)\n\n"
            "### Verification Steps\n"
            "- Check cache_hit_ratio > 0.8\n"
            "- Verify payment_failure_rate < 0.05\n"
        )

        mock_llm = AsyncMock()
        mock_llm.bind_tools.return_value = mock_llm
        mock_llm.ainvoke.return_value = AIMessage(content=response_text)

        state = {
            "messages": [],
            "root_cause": "Redis cache failure",
            "blast_radius": [{"service": "payment-service", "impact_level": "direct", "slo_at_risk": "latency"}],
            "confidence": 0.85,
        }

        with patch("agents.responder.get_llm", return_value=mock_llm):
            result = await responder_node(state=state, tools=[])

        assert "Remediation Plan" in result["remediation_plan"]
        assert "redis-cache" in result["remediation_plan"]
        assert len(result["messages"]) > 0
