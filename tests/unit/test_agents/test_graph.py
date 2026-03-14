"""Unit tests for graph routing logic."""

from langgraph.graph import END

from agents.graph import route_after_analyst, route_after_monitor


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
