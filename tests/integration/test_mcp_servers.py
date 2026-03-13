"""Integration tests for MCP server tools — requires docker compose up + graph seeding."""

import importlib.util
import json
import os

import pytest

pytestmark = pytest.mark.integration

# Load MCP server modules from hyphenated path
_base = os.path.join(os.path.dirname(__file__), "../..")

_prom_spec = importlib.util.spec_from_file_location("prom", os.path.join(_base, "mcp-servers/prometheus_mcp/server.py"))
_prom = importlib.util.module_from_spec(_prom_spec)
_prom_spec.loader.exec_module(_prom)

_graf_spec = importlib.util.spec_from_file_location("graf", os.path.join(_base, "mcp-servers/grafana_mcp/server.py"))
_graf = importlib.util.module_from_spec(_graf_spec)
_graf_spec.loader.exec_module(_graf)

_neo_spec = importlib.util.spec_from_file_location("neo", os.path.join(_base, "mcp-servers/neo4j_mcp/server.py"))
_neo = importlib.util.module_from_spec(_neo_spec)
_neo_spec.loader.exec_module(_neo)


# --- Prometheus ---

@pytest.mark.asyncio
async def test_prom_list_metrics():
    result = json.loads(await _prom.list_metrics())
    assert isinstance(result, list)
    assert "gateway_requests_total" in result


@pytest.mark.asyncio
async def test_prom_execute_promql_instant():
    result = json.loads(await _prom.execute_promql("up"))
    assert result["resultType"] == "vector"
    assert len(result["result"]) >= 5  # 5 services


@pytest.mark.asyncio
async def test_prom_get_targets():
    result = json.loads(await _prom.get_targets())
    jobs = {t["job"] for t in result}
    assert {"api-gateway", "payment-service", "user-service", "order-service", "redis-cache"}.issubset(jobs)


# --- Grafana ---

@pytest.mark.asyncio
async def test_grafana_list_dashboards():
    result = json.loads(await _graf.list_dashboards())
    uids = {d["uid"] for d in result}
    assert "infrawatch-overview" in uids


@pytest.mark.asyncio
async def test_grafana_get_dashboard():
    result = json.loads(await _graf.get_dashboard("infrawatch-overview"))
    assert result["dashboard"]["title"] == "InfraWatch Overview"


@pytest.mark.asyncio
async def test_grafana_get_panel_summary():
    result = json.loads(await _graf.get_panel("infrawatch-overview"))
    assert isinstance(result, list)
    assert len(result) > 0
    titles = {p["title"] for p in result}
    assert "Request Rate" in titles or "Gateway Request Rate" in titles


# --- Neo4j ---

@pytest.mark.asyncio
async def test_neo4j_run_cypher():
    result = json.loads(await _neo.run_cypher("MATCH (s:Service) RETURN s.name AS name ORDER BY name"))
    names = [r["name"] for r in result]
    assert len(names) == 5
    assert "redis-cache" in names


@pytest.mark.asyncio
async def test_neo4j_get_service_dependencies_downstream():
    result = json.loads(await _neo.get_service_dependencies("api-gateway", direction="downstream"))
    downstream_services = set()
    for r in result:
        downstream_services.update(r["services"])
    downstream_services.discard("api-gateway")
    assert {"payment-service", "user-service", "order-service"}.issubset(downstream_services)


@pytest.mark.asyncio
async def test_neo4j_get_blast_radius():
    result = json.loads(await _neo.get_blast_radius("redis-cache"))
    assert result["service"] == "redis-cache"
    affected_names = {r["service"] for r in result["affected"]}
    # payment, user, order depend directly; api-gateway transitively
    assert {"payment-service", "user-service", "order-service"}.issubset(affected_names)
