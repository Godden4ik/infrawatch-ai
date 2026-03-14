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
search_runbooks = _mod.search_runbooks
find_similar_incidents = _mod.find_similar_incidents
get_runbook_for_service = _mod.get_runbook_for_service
search_knowledge_base = _mod.search_knowledge_base


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


# ── Tests for new GraphRAG tools ─────────────────────────────────────


FAKE_EMBEDDING = [0.1] * 384


@pytest.mark.asyncio
async def test_search_runbooks_returns_results():
    records = [
        {
            "content": "Check Redis health",
            "step_title": "Verify Redis",
            "runbook_id": "RB-001",
            "runbook_title": "Redis Cache Failure Recovery",
            "category": "cache",
            "severity": "P1",
            "applies_to_services": ["redis-cache"],
            "referenced_services": ["redis-cache"],
            "score": 0.9,
        }
    ]
    with patch.object(_mod, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await search_runbooks("redis is down"))
        assert len(result) == 1
        assert result[0]["runbook_id"] == "RB-001"


@pytest.mark.asyncio
async def test_search_runbooks_boosts_service_match():
    records = [
        {
            "content": "Generic step",
            "step_title": "Step A",
            "runbook_id": "RB-003",
            "runbook_title": "API Gateway Errors",
            "category": "error",
            "severity": "P2",
            "applies_to_services": ["api-gateway"],
            "referenced_services": [],
            "score": 0.95,
        },
        {
            "content": "Redis step",
            "step_title": "Step B",
            "runbook_id": "RB-001",
            "runbook_title": "Redis Failure",
            "category": "cache",
            "severity": "P1",
            "applies_to_services": ["redis-cache"],
            "referenced_services": ["redis-cache"],
            "score": 0.85,
        },
    ]
    with patch.object(_mod, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await search_runbooks("cache failure", service_name="redis-cache"))
        # Redis result should be boosted to top despite lower score
        assert result[0]["runbook_id"] == "RB-001"


@pytest.mark.asyncio
async def test_find_similar_incidents_returns_results():
    records = [
        {
            "incident_id": "INC-2024-001",
            "title": "Redis OOM Cascade",
            "severity": "P1",
            "root_cause": "Redis OOM",
            "resolution": "Restarted Redis",
            "duration_minutes": 45,
            "affected_services": ["redis-cache"],
            "root_cause_services": ["redis-cache"],
            "resolved_by_runbooks": ["RB-001"],
            "symptoms": ["memory_pressure"],
            "score": 0.9,
        }
    ]
    with patch.object(_mod, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await find_similar_incidents("redis out of memory"))
        assert len(result) == 1
        assert result[0]["incident_id"] == "INC-2024-001"


@pytest.mark.asyncio
async def test_find_similar_incidents_severity_filter():
    records = [
        {"incident_id": "INC-001", "title": "P1 Inc", "severity": "P1",
         "root_cause": "x", "resolution": "y", "duration_minutes": 10,
         "affected_services": [], "root_cause_services": [],
         "resolved_by_runbooks": [], "symptoms": [], "score": 0.9},
        {"incident_id": "INC-002", "title": "P3 Inc", "severity": "P3",
         "root_cause": "x", "resolution": "y", "duration_minutes": 5,
         "affected_services": [], "root_cause_services": [],
         "resolved_by_runbooks": [], "symptoms": [], "score": 0.8},
    ]
    with patch.object(_mod, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await find_similar_incidents("issue", severity="P1"))
        assert len(result) == 1
        assert result[0]["severity"] == "P1"


@pytest.mark.asyncio
async def test_get_runbook_for_service_returns_runbooks():
    # Use simple types to avoid _serialize_value treating dicts as Neo4j Nodes
    records = [
        {
            "runbook_id": "RB-001",
            "title": "Redis Cache Failure Recovery",
            "category": "cache",
            "severity": "P1",
            "author": "platform-team",
            "steps": ["Step 1: Check Redis health"],
        }
    ]
    with patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await get_runbook_for_service("redis-cache"))
        assert result["service"] == "redis-cache"
        assert len(result["runbooks"]) == 1
        assert result["runbooks"][0]["runbook_id"] == "RB-001"


@pytest.mark.asyncio
async def test_get_runbook_for_service_no_results():
    with patch.object(_mod, "_make_driver", return_value=_make_mock_driver([])):
        result = json.loads(await get_runbook_for_service("nonexistent-service"))
        assert result["runbooks"] == []
        assert "No runbooks found" in result["message"]


@pytest.mark.asyncio
async def test_get_runbook_for_service_category_filter():
    records = [
        {"runbook_id": "RB-001", "title": "Cache Recovery", "category": "cache",
         "severity": "P1", "author": "platform", "steps": "step1"},
        {"runbook_id": "RB-004", "title": "Memory Leak", "category": "memory",
         "severity": "P2", "author": "platform", "steps": "step1"},
    ]
    with patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await get_runbook_for_service("redis-cache", category="cache"))
        assert len(result["runbooks"]) == 1
        assert result["runbooks"][0]["category"] == "cache"


@pytest.mark.asyncio
async def test_search_knowledge_base_graphrag_mode():
    records = [
        {"content": "step content", "step_title": "step", "runbook_id": "RB-001",
         "runbook_title": "title", "services": ["redis-cache"], "references": [], "score": 0.9},
    ]
    with patch.object(_mod, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await search_knowledge_base("redis down", mode="graphrag"))
        assert result["mode"] == "graphrag"
        assert "runbooks" in result
        assert "incidents" in result


@pytest.mark.asyncio
async def test_search_knowledge_base_naive_mode():
    records = [
        {"content": "step content", "step_title": "step", "runbook_id": "RB-001",
         "runbook_title": "title", "score": 0.9},
    ]
    with patch.object(_mod, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(_mod, "_make_driver", return_value=_make_mock_driver(records)):
        result = json.loads(await search_knowledge_base("redis down", mode="naive"))
        assert result["mode"] == "naive"


@pytest.mark.asyncio
async def test_search_knowledge_base_invalid_mode():
    result = json.loads(await search_knowledge_base("test", mode="invalid"))
    assert "error" in result
