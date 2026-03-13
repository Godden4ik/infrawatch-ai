"""Unit tests for Grafana MCP server tools."""

import importlib.util
import json
import os
from unittest.mock import AsyncMock, patch

import httpx
import pytest

_spec = importlib.util.spec_from_file_location(
    "grafana_mcp_server",
    os.path.join(os.path.dirname(__file__), "../../mcp-servers/grafana_mcp/server.py"),
)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

list_dashboards = _mod.list_dashboards
get_dashboard = _mod.get_dashboard
get_panel = _mod.get_panel
list_alerts = _mod.list_alerts


class MockAsyncClient:
    def __init__(self, handler):
        self._handler = handler
        self._calls = []

    async def get(self, *args, **kwargs):
        self._calls.append((args, kwargs))
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
    return patch.object(_mod, "_make_client", return_value=mock_client), mock_client


SAMPLE_DASHBOARD = {
    "dashboard": {
        "uid": "infrawatch-overview",
        "title": "InfraWatch Overview",
        "panels": [
            {"type": "row", "title": "API Gateway", "panels": [
                {"id": 1, "title": "Request Rate", "type": "timeseries", "targets": [{"expr": "rate(gateway_requests_total[5m])"}]},
                {"id": 2, "title": "Latency", "type": "timeseries", "targets": []},
            ]},
            {"id": 10, "title": "Standalone Panel", "type": "gauge"},
        ],
    }
}


@pytest.mark.asyncio
async def test_list_dashboards():
    mock_data = [{"uid": "infrawatch-overview", "title": "InfraWatch Overview", "tags": [], "url": "/d/infrawatch-overview"}]
    patcher, _ = _patch_client(lambda *a, **kw: _mock_response(mock_data))
    with patcher:
        result = json.loads(await list_dashboards())
        assert len(result) == 1
        assert result[0]["uid"] == "infrawatch-overview"


@pytest.mark.asyncio
async def test_list_dashboards_with_tag():
    patcher, mock_client = _patch_client(lambda *a, **kw: _mock_response([]))
    with patcher:
        await list_dashboards(tag="monitoring")
        _, kwargs = mock_client._calls[0]
        assert kwargs["params"]["tag"] == "monitoring"


@pytest.mark.asyncio
async def test_get_dashboard():
    patcher, _ = _patch_client(lambda *a, **kw: _mock_response(SAMPLE_DASHBOARD))
    with patcher:
        result = json.loads(await get_dashboard("infrawatch-overview"))
        assert result["dashboard"]["uid"] == "infrawatch-overview"


@pytest.mark.asyncio
async def test_get_panel_by_id():
    patcher, _ = _patch_client(lambda *a, **kw: _mock_response(SAMPLE_DASHBOARD))
    with patcher:
        result = json.loads(await get_panel("infrawatch-overview", panel_id=1))
        assert result["title"] == "Request Rate"


@pytest.mark.asyncio
async def test_get_panel_by_title():
    patcher, _ = _patch_client(lambda *a, **kw: _mock_response(SAMPLE_DASHBOARD))
    with patcher:
        result = json.loads(await get_panel("infrawatch-overview", panel_title="latency"))
        assert result["id"] == 2


@pytest.mark.asyncio
async def test_get_panel_summary():
    patcher, _ = _patch_client(lambda *a, **kw: _mock_response(SAMPLE_DASHBOARD))
    with patcher:
        result = json.loads(await get_panel("infrawatch-overview"))
        assert len(result) == 3
        assert all("id" in p and "title" in p for p in result)


@pytest.mark.asyncio
async def test_get_panel_not_found():
    patcher, _ = _patch_client(lambda *a, **kw: _mock_response(SAMPLE_DASHBOARD))
    with patcher:
        result = json.loads(await get_panel("infrawatch-overview", panel_id=999))
        assert "error" in result


@pytest.mark.asyncio
async def test_list_alerts_empty():
    patcher, _ = _patch_client(lambda *a, **kw: _mock_response([]))
    with patcher:
        result = json.loads(await list_alerts())
        assert result == []


@pytest.mark.asyncio
async def test_list_alerts_filtered():
    alerts = [{"state": "alerting", "name": "HighErrors"}, {"state": "ok", "name": "Normal"}]
    patcher, _ = _patch_client(lambda *a, **kw: _mock_response(alerts))
    with patcher:
        result = json.loads(await list_alerts(state="alerting"))
        assert len(result) == 1
        assert result[0]["name"] == "HighErrors"
