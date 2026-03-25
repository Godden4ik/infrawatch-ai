"""Unit tests for Prometheus MCP server tools."""

import importlib.util
import json
import os
from unittest.mock import AsyncMock, patch

import httpx
import pytest

# Load module from hyphenated path
_spec = importlib.util.spec_from_file_location(
    "prometheus_mcp_server",
    os.path.join(os.path.dirname(__file__), "../../mcp-servers/prometheus_mcp/server.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

execute_promql = _mod.execute_promql
list_metrics = _mod.list_metrics
get_targets = _mod.get_targets


class MockAsyncClient:
    """Mock httpx.AsyncClient that supports async context manager."""

    def __init__(self, handler):
        self._handler = handler

    async def get(self, *args, **kwargs):
        return self._handler(*args, **kwargs)

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        pass


def _mock_response(data):
    resp = AsyncMock(spec=httpx.Response)
    resp.status_code = 200
    resp.json.return_value = data
    resp.raise_for_status = lambda: None
    return resp


def _patch_client(handler):
    mock_client = MockAsyncClient(handler)
    return patch.object(_mod, "_make_client", return_value=mock_client)


@pytest.mark.asyncio
async def test_execute_promql_instant():
    mock_data = {"status": "success", "data": {"resultType": "vector", "result": [{"metric": {"__name__": "up"}, "value": [1, "1"]}]}}
    with _patch_client(lambda *a, **kw: _mock_response(mock_data)):
        result = json.loads(await execute_promql("up"))
        assert result["resultType"] == "vector"
        assert len(result["result"]) == 1


@pytest.mark.asyncio
async def test_execute_promql_range():
    mock_data = {"status": "success", "data": {"resultType": "matrix", "result": []}}
    calls = []

    def handler(*args, **kwargs):
        calls.append(args)
        return _mock_response(mock_data)

    with _patch_client(handler):
        result = json.loads(await execute_promql("up", start="2024-01-01T00:00:00Z", end="2024-01-01T01:00:00Z"))
        assert result["resultType"] == "matrix"
        assert "query_range" in calls[0][0]


@pytest.mark.asyncio
async def test_execute_promql_connection_error():
    def handler(*a, **kw):
        raise httpx.ConnectError("refused")

    with _patch_client(handler):
        result = json.loads(await execute_promql("up"))
        assert "error" in result
        assert "Cannot connect" in result["error"]


@pytest.mark.asyncio
async def test_list_metrics():
    mock_data = {"status": "success", "data": ["gateway_requests_total", "up"]}
    with _patch_client(lambda *a, **kw: _mock_response(mock_data)):
        result = json.loads(await list_metrics())
        assert "gateway_requests_total" in result


@pytest.mark.asyncio
async def test_get_targets():
    mock_data = {
        "status": "success",
        "data": {
            "activeTargets": [
                {"labels": {"job": "api-gateway", "instance": "api-gateway:8000"}, "health": "up", "lastScrape": "2024-01-01T00:00:00Z"},
            ]
        },
    }
    with _patch_client(lambda *a, **kw: _mock_response(mock_data)):
        result = json.loads(await get_targets())
        assert len(result) == 1
        assert result[0]["job"] == "api-gateway"
        assert result[0]["health"] == "up"
