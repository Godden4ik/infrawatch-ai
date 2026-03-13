"""Unit tests for Neo4j MCP server tools."""

import importlib.util
import json
import os
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

_spec = importlib.util.spec_from_file_location(
    "neo4j_mcp_server",
    os.path.join(os.path.dirname(__file__), "../../mcp-servers/neo4j_mcp/server.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

run_cypher = _mod.run_cypher
get_service_dependencies = _mod.get_service_dependencies
get_blast_radius = _mod.get_blast_radius


class FakeRecord:
    """Mimics a neo4j.Record with simple key-value data."""

    def __init__(self, data: dict):
        self._data = data

    def keys(self):
        return self._data.keys()

    def __getitem__(self, key):
        return self._data[key]


class FakeResult:
    """Async iterable of FakeRecord objects."""

    def __init__(self, records: list[dict]):
        self._records = [FakeRecord(r) for r in records]
        self._index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._records):
            raise StopAsyncIteration
        record = self._records[self._index]
        self._index += 1
        return record


def _make_mock_driver(records: list[dict]):
    """Create a mock AsyncGraphDatabase driver returning given records."""
    mock_result = FakeResult(records)
    mock_session = AsyncMock()
    mock_session.run = AsyncMock(return_value=mock_result)
    mock_session.__aenter__ = AsyncMock(return_value=mock_session)
    mock_session.__aexit__ = AsyncMock(return_value=None)

    mock_driver = MagicMock()
    mock_driver.session.return_value = mock_session
    return mock_driver


@pytest.mark.asyncio
async def test_run_cypher_returns_records():
    records = [{"name": "api-gateway"}, {"name": "redis-cache"}]
    with patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await run_cypher("MATCH (s:Service) RETURN s.name AS name"))
        assert len(result) == 2
        assert result[0]["name"] == "api-gateway"


@pytest.mark.asyncio
async def test_run_cypher_with_params():
    records = [{"name": "redis-cache"}]
    mock_driver = _make_mock_driver(records)
    with patch.object(_mod, "_make_driver", return_value=mock_driver):
        result = json.loads(await run_cypher(
            "MATCH (s:Service {name: $name}) RETURN s.name AS name",
            params='{"name": "redis-cache"}',
        ))
        assert result[0]["name"] == "redis-cache"


@pytest.mark.asyncio
async def test_run_cypher_invalid_params():
    result = json.loads(await run_cypher("MATCH (s) RETURN s", params="not valid json"))
    assert "error" in result
    assert "Invalid JSON" in result["error"]


@pytest.mark.asyncio
async def test_get_service_dependencies_downstream():
    records = [
        {"services": ["api-gateway", "payment-service"], "relationships": ["ROUTES_TO"], "depth": 1},
    ]
    with patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await get_service_dependencies("api-gateway", direction="downstream"))
        assert len(result) == 1
        assert "payment-service" in result[0]["services"]


@pytest.mark.asyncio
async def test_get_service_dependencies_upstream():
    records = [
        {"services": ["payment-service", "redis-cache"], "relationships": ["DEPENDS_ON"], "depth": 1},
    ]
    with patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await get_service_dependencies("redis-cache", direction="upstream"))
        assert len(result) == 1


@pytest.mark.asyncio
async def test_get_service_dependencies_invalid_direction():
    result = json.loads(await get_service_dependencies("redis-cache", direction="sideways"))
    assert "error" in result


@pytest.mark.asyncio
async def test_get_blast_radius_returns_affected():
    records = [
        {"service": "payment-service", "type": "backend", "slo_latency_ms": 500, "slo_error_rate": 0.005, "owner": "payments-team", "dependency_chain": ["DEPENDS_ON"], "depth": 1},
        {"service": "api-gateway", "type": "gateway", "slo_latency_ms": 100, "slo_error_rate": 0.01, "owner": "platform-team", "dependency_chain": ["ROUTES_TO", "DEPENDS_ON"], "depth": 2},
    ]
    with patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await get_blast_radius("redis-cache"))
        assert result["service"] == "redis-cache"
        assert len(result["affected"]) == 2


@pytest.mark.asyncio
async def test_get_blast_radius_no_dependents():
    with patch.object(_mod, "_make_driver", return_value=_make_mock_driver([])):
        result = json.loads(await get_blast_radius("api-gateway"))
        assert result["affected"] == []
        assert "No upstream" in result["message"]
