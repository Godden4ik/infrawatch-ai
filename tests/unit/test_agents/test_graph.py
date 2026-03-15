"""Unit tests for graph routing logic and build_graph LLM provider wiring."""

from functools import partial
from unittest.mock import MagicMock, patch

from langgraph.graph import END

from agents.graph import build_graph, route_after_analyst, route_after_monitor


class TestRouteAfterMonitor:
    def test_routes_to_analyst_when_anomalies(self):
        state = {"has_anomalies": True}
        assert route_after_monitor(state) == "analyst"

    def test_routes_to_end_when_clean(self):
        state = {"has_anomalies": False}
        assert route_after_monitor(state) == END

    def test_routes_to_end_when_missing(self):
        state = {}
        assert route_after_monitor(state) == END


class TestRouteAfterAnalyst:
    def test_routes_to_responder_normally(self):
        state = {"confidence": 0.8, "iteration": 1}
        assert route_after_analyst(state) == "responder"

    def test_routes_to_monitor_on_low_confidence(self):
        state = {"confidence": 0.2, "iteration": 0}
        assert route_after_analyst(state) == "monitor"

    def test_routes_to_responder_when_iteration_limit(self):
        state = {"confidence": 0.1, "iteration": 2}
        assert route_after_analyst(state) == "responder"

    def test_routes_to_responder_when_confidence_missing(self):
        state = {}
        assert route_after_analyst(state) == "responder"

    def test_boundary_confidence_0_3(self):
        state = {"confidence": 0.3, "iteration": 0}
        assert route_after_analyst(state) == "responder"


class TestBuildGraphLLMProvider:
    """Verify that llm_provider and llm_model are threaded into each node via partial.

    We intercept functools.partial calls made inside build_graph to check the
    keyword arguments passed to each node — without relying on LangGraph internals.
    """

    def _capture_partials(self, **build_kwargs) -> list:
        """Run build_graph and return all partial() calls recorded."""
        calls = []
        real_partial = partial

        def capturing_partial(func, **kwargs):
            calls.append({"func": func.__name__ if hasattr(func, "__name__") else str(func), "kwargs": kwargs})
            return real_partial(func, **kwargs)

        with patch("agents.graph.partial", side_effect=capturing_partial):
            build_graph(monitor_tools=[], analyst_tools=[], responder_tools=[], **build_kwargs)
        return calls

    def test_default_provider_is_anthropic(self):
        calls = self._capture_partials()
        providers = {c["kwargs"].get("llm_provider") for c in calls}
        assert providers == {"anthropic"}

    def test_ollama_provider_threaded_to_all_nodes(self):
        calls = self._capture_partials(llm_provider="ollama", llm_model="qwen2.5:14b")
        assert len(calls) == 3  # monitor, analyst, responder
        for c in calls:
            assert c["kwargs"]["llm_provider"] == "ollama"
            assert c["kwargs"]["llm_model"] == "qwen2.5:14b"

    def test_model_none_by_default(self):
        calls = self._capture_partials()
        for c in calls:
            assert c["kwargs"].get("llm_model") is None

    def test_build_graph_compiles_without_error(self):
        graph = build_graph(monitor_tools=[], analyst_tools=[], responder_tools=[], llm_provider="ollama")
        assert graph is not None
