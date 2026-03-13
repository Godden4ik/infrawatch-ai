"""Grafana MCP Server — exposes dashboard, panel, and alert tools for agents."""

import json
import os

import httpx
from mcp.server.fastmcp import FastMCP

GRAFANA_URL = os.getenv("GRAFANA_URL", "http://localhost:3000")
GRAFANA_USER = os.getenv("GRAFANA_USER", "admin")
GRAFANA_PASSWORD = os.getenv("GRAFANA_PASSWORD", "infrawatch")

mcp = FastMCP(
    name="grafana-mcp",
    instructions=(
        "Grafana dashboard server for InfraWatch infrastructure. "
        "The primary dashboard is 'infrawatch-overview' with panels for "
        "API Gateway, Payment Service, User Service, Order Service, and Redis Cache. "
        "Each section has panels for request rate, latency, error rate, and service-specific metrics."
    ),
)

_client: httpx.AsyncClient | None = None


async def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            base_url=GRAFANA_URL,
            auth=httpx.BasicAuth(GRAFANA_USER, GRAFANA_PASSWORD),
            timeout=30.0,
        )
    return _client


@mcp.tool()
async def list_dashboards(tag: str | None = None) -> str:
    """List available Grafana dashboards, optionally filtered by tag."""
    client = await _get_client()
    try:
        params = {"type": "dash-db"}
        if tag:
            params["tag"] = tag
        resp = await client.get("/api/search", params=params)
        resp.raise_for_status()
        dashboards = [
            {"uid": d["uid"], "title": d["title"], "tags": d.get("tags", []), "url": d.get("url")}
            for d in resp.json()
        ]
        return json.dumps(dashboards, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"Grafana returned {e.response.status_code}", "detail": e.response.text})
    except httpx.ConnectError:
        return json.dumps({"error": f"Cannot connect to Grafana at {GRAFANA_URL}"})


@mcp.tool()
async def get_dashboard(uid: str) -> str:
    """Get full dashboard model by UID. The primary dashboard UID is 'infrawatch-overview'."""
    client = await _get_client()
    try:
        resp = await client.get(f"/api/dashboards/uid/{uid}")
        resp.raise_for_status()
        return json.dumps(resp.json(), indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"Grafana returned {e.response.status_code}", "detail": e.response.text})
    except httpx.ConnectError:
        return json.dumps({"error": f"Cannot connect to Grafana at {GRAFANA_URL}"})


@mcp.tool()
async def get_panel(
    dashboard_uid: str,
    panel_id: int | None = None,
    panel_title: str | None = None,
) -> str:
    """Get a specific panel from a Grafana dashboard.

    Provide `panel_id` or `panel_title` to get one panel.
    If neither is provided, returns a summary of all panels (id, title, type).
    """
    client = await _get_client()
    try:
        resp = await client.get(f"/api/dashboards/uid/{dashboard_uid}")
        resp.raise_for_status()
        dashboard = resp.json()["dashboard"]
        panels = dashboard.get("panels", [])

        # Flatten: rows can contain nested panels
        flat_panels = []
        for p in panels:
            if p.get("type") == "row":
                flat_panels.extend(p.get("panels", []))
            else:
                flat_panels.append(p)

        if panel_id is not None:
            match = [p for p in flat_panels if p.get("id") == panel_id]
            if not match:
                return json.dumps({"error": f"No panel with id={panel_id}"})
            return json.dumps(match[0], indent=2)

        if panel_title is not None:
            title_lower = panel_title.lower()
            match = [p for p in flat_panels if title_lower in p.get("title", "").lower()]
            if not match:
                return json.dumps({"error": f"No panel matching title '{panel_title}'"})
            return json.dumps(match[0], indent=2)

        # Return summary of all panels
        summary = [
            {"id": p.get("id"), "title": p.get("title"), "type": p.get("type")}
            for p in flat_panels
        ]
        return json.dumps(summary, indent=2)

    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"Grafana returned {e.response.status_code}", "detail": e.response.text})
    except httpx.ConnectError:
        return json.dumps({"error": f"Cannot connect to Grafana at {GRAFANA_URL}"})


@mcp.tool()
async def list_alerts(state: str | None = None) -> str:
    """List Grafana alert rules and their current state.

    Optionally filter by `state`: 'alerting', 'ok', 'pending', 'nodata', 'error'.
    """
    client = await _get_client()
    try:
        resp = await client.get("/api/alerts")
        resp.raise_for_status()
        alerts = resp.json()

        if state:
            alerts = [a for a in alerts if a.get("state") == state]

        return json.dumps(alerts, indent=2)
    except httpx.HTTPStatusError as e:
        return json.dumps({"error": f"Grafana returned {e.response.status_code}", "detail": e.response.text})
    except httpx.ConnectError:
        return json.dumps({"error": f"Cannot connect to Grafana at {GRAFANA_URL}"})


if __name__ == "__main__":
    mcp.run(transport="stdio")
