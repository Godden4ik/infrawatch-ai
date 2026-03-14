"""Unit tests for graph/retrieval.py — GraphRAG vs Naive RAG result structure."""

import os
import sys
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

from graph import retrieval


# ── Fake Neo4j result helpers ────────────────────────────────────────


class FakeRecord:
    def __init__(self, data: dict):
        self._data = data

    def keys(self):
        return self._data.keys()

    def __getitem__(self, key):
        return self._data[key]


class FakeResult:
    def __init__(self, records: list[dict]):
        self._records = [FakeRecord(r) for r in records]
        self._index = 0

    def __aiter__(self):
        return self

    async def __anext__(self):
        if self._index >= len(self._records):
            raise StopAsyncIteration
        r = self._records[self._index]
        self._index += 1
        return r

    async def single(self):
        return self._records[0] if self._records else None


FAKE_RUNBOOK_RESULTS = [
    {
        "content": "Check Redis connectivity and memory usage.",
        "step_title": "Verify Redis health",
        "runbook_id": "RB-001",
        "runbook_title": "Redis Cache Failure Recovery",
        "category": "cache",
        "severity": "P1",
        "applies_to_services": ["redis-cache", "payment-service"],
        "referenced_services": ["redis-cache"],
        "downstream_dependencies": ["payment-service"],
        "score": 0.92,
    },
]

FAKE_INCIDENT_RESULTS = [
    {
        "incident_id": "INC-2024-001",
        "title": "Redis OOM Cascade",
        "severity": "P1",
        "root_cause": "Redis exceeded maxmemory",
        "resolution": "Restarted Redis with increased maxmemory",
        "description": "Redis hit OOM condition.",
        "duration_minutes": 45,
        "affected_services": ["redis-cache", "payment-service"],
        "root_cause_services": ["redis-cache"],
        "resolved_by_runbooks": ["RB-001"],
        "symptoms": ["memory_pressure", "cache_miss_storm"],
        "root_cause_dependencies": ["payment-service"],
        "score": 0.88,
    },
]

FAKE_SERVICE_CONTEXT = {
    "service": "redis-cache",
    "type": "datastore",
    "owner": "platform-team",
    "slo_latency_ms": 5,
    "runbooks": ["RB-001", "RB-004"],
    "incidents_affected": ["INC-2024-001"],
    "incidents_root_cause": ["INC-2024-001"],
    "downstream": [],
    "upstream": [{"name": "payment-service", "rel": "DEPENDS_ON"}],
}

NAIVE_RUNBOOK_RESULTS = [
    {
        "content": "Check Redis connectivity and memory usage.",
        "step_title": "Verify Redis health",
        "runbook_id": "RB-001",
        "runbook_title": "Redis Cache Failure Recovery",
        "score": 0.92,
    },
]

NAIVE_INCIDENT_RESULTS = [
    {
        "incident_id": "INC-2024-001",
        "title": "Redis OOM Cascade",
        "description": "Redis hit OOM condition.",
        "root_cause": "Redis exceeded maxmemory",
        "resolution": "Restarted Redis with increased maxmemory",
        "score": 0.88,
    },
]


def _make_mock_session(runbook_results, incident_results, service_context=None):
    """Create a mock session that returns different results per query."""
    call_count = [0]

    async def mock_run(query, **kwargs):
        call_count[0] += 1
        if "runbook_step_embedding" in query:
            return FakeResult(runbook_results)
        elif "incident_embedding" in query:
            return FakeResult(incident_results)
        elif "service_name" in kwargs:
            return FakeResult([service_context] if service_context else [])
        return FakeResult([])

    session = AsyncMock()
    session.run = mock_run
    session.__aenter__ = AsyncMock(return_value=session)
    session.__aexit__ = AsyncMock(return_value=None)
    return session


def _make_mock_driver(session):
    driver = MagicMock()
    driver.session.return_value = session
    driver.close = AsyncMock()
    return driver


FAKE_EMBEDDING = [0.1] * 384


# ── GraphRAG tests ───────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_graphrag_retrieve_returns_all_fields():
    session = _make_mock_session(FAKE_RUNBOOK_RESULTS, FAKE_INCIDENT_RESULTS, FAKE_SERVICE_CONTEXT)
    driver = _make_mock_driver(session)

    with patch.object(retrieval, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(retrieval, "_make_driver", return_value=driver):
        result = await retrieval.graphrag_retrieve("redis cache down", service_context="redis-cache")

    assert "runbook_results" in result
    assert "incident_results" in result
    assert "service_context" in result
    assert len(result["runbook_results"]) == 1
    assert len(result["incident_results"]) == 1
    assert result["service_context"] is not None


@pytest.mark.asyncio
async def test_graphrag_runbook_results_have_graph_context():
    session = _make_mock_session(FAKE_RUNBOOK_RESULTS, FAKE_INCIDENT_RESULTS)
    driver = _make_mock_driver(session)

    with patch.object(retrieval, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(retrieval, "_make_driver", return_value=driver):
        result = await retrieval.graphrag_retrieve("redis cache failure")

    rb = result["runbook_results"][0]
    assert "applies_to_services" in rb
    assert "referenced_services" in rb
    assert "redis-cache" in rb["applies_to_services"]


@pytest.mark.asyncio
async def test_graphrag_incident_results_have_graph_context():
    session = _make_mock_session(FAKE_RUNBOOK_RESULTS, FAKE_INCIDENT_RESULTS)
    driver = _make_mock_driver(session)

    with patch.object(retrieval, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(retrieval, "_make_driver", return_value=driver):
        result = await retrieval.graphrag_retrieve("redis OOM")

    inc = result["incident_results"][0]
    assert "affected_services" in inc
    assert "root_cause_services" in inc
    assert "resolved_by_runbooks" in inc
    assert "symptoms" in inc


@pytest.mark.asyncio
async def test_graphrag_without_service_context():
    session = _make_mock_session(FAKE_RUNBOOK_RESULTS, FAKE_INCIDENT_RESULTS)
    driver = _make_mock_driver(session)

    with patch.object(retrieval, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(retrieval, "_make_driver", return_value=driver):
        result = await retrieval.graphrag_retrieve("latency spike")

    assert result["service_context"] is None


# ── Naive RAG tests ──────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_naive_retrieve_returns_flat_results():
    session = _make_mock_session(NAIVE_RUNBOOK_RESULTS, NAIVE_INCIDENT_RESULTS)
    driver = _make_mock_driver(session)

    with patch.object(retrieval, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(retrieval, "_make_driver", return_value=driver):
        result = await retrieval.naive_rag_retrieve("redis cache down")

    assert "runbook_results" in result
    assert "incident_results" in result
    # Naive should NOT have service_context
    assert "service_context" not in result


@pytest.mark.asyncio
async def test_naive_runbook_results_lack_graph_fields():
    session = _make_mock_session(NAIVE_RUNBOOK_RESULTS, NAIVE_INCIDENT_RESULTS)
    driver = _make_mock_driver(session)

    with patch.object(retrieval, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(retrieval, "_make_driver", return_value=driver):
        result = await retrieval.naive_rag_retrieve("redis failure")

    rb = result["runbook_results"][0]
    assert "applies_to_services" not in rb
    assert "referenced_services" not in rb


@pytest.mark.asyncio
async def test_naive_incident_results_lack_graph_fields():
    session = _make_mock_session(NAIVE_RUNBOOK_RESULTS, NAIVE_INCIDENT_RESULTS)
    driver = _make_mock_driver(session)

    with patch.object(retrieval, "_embed", return_value=FAKE_EMBEDDING), \
         patch.object(retrieval, "_make_driver", return_value=driver):
        result = await retrieval.naive_rag_retrieve("OOM crash")

    inc = result["incident_results"][0]
    assert "affected_services" not in inc
    assert "symptoms" not in inc


# ── Comparison tests ─────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_graphrag_has_more_context_than_naive():
    """GraphRAG results should contain strictly more fields than naive."""
    graphrag_session = _make_mock_session(FAKE_RUNBOOK_RESULTS, FAKE_INCIDENT_RESULTS)
    naive_session = _make_mock_session(NAIVE_RUNBOOK_RESULTS, NAIVE_INCIDENT_RESULTS)

    graphrag_driver = _make_mock_driver(graphrag_session)
    naive_driver = _make_mock_driver(naive_session)

    with patch.object(retrieval, "_embed", return_value=FAKE_EMBEDDING):
        with patch.object(retrieval, "_make_driver", return_value=graphrag_driver):
            gr = await retrieval.graphrag_retrieve("redis down")
        with patch.object(retrieval, "_make_driver", return_value=naive_driver):
            naive = await retrieval.naive_rag_retrieve("redis down")

    gr_rb_keys = set(gr["runbook_results"][0].keys())
    naive_rb_keys = set(naive["runbook_results"][0].keys())
    # GraphRAG should have a superset of fields
    assert naive_rb_keys.issubset(gr_rb_keys)
    assert len(gr_rb_keys) > len(naive_rb_keys)
