"""Unit tests for the anomaly injection script logic."""

import pytest

from scripts.inject_anomaly import SERVICE_PORTS, SCENARIOS


def test_all_services_have_ports():
    expected = {"api-gateway", "payment-service", "user-service", "order-service", "redis-cache"}
    assert set(SERVICE_PORTS.keys()) == expected


def test_service_ports_are_unique():
    ports = list(SERVICE_PORTS.values())
    assert len(ports) == len(set(ports))


def test_scenarios_registered():
    assert "cascade" in SCENARIOS
    assert "reset" in SCENARIOS


def test_scenario_values_are_callable():
    for name, fn in SCENARIOS.items():
        assert callable(fn), f"SCENARIOS['{name}'] is not callable"
