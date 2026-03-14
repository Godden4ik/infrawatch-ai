"""Neo4j topology → pyvis interactive graph rendering."""

import os
import tempfile

import streamlit as st
import streamlit.components.v1 as components

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")

NODE_COLORS = {
    "green": "#2ecc71",
    "yellow": "#f39c12",
    "red": "#e74c3c",
    "unknown": "#95a5a6",
}

EDGE_COLORS = {
    "DEPENDS_ON": "#3498db",
    "CALLS": "#9b59b6",
    "ROUTES_TO": "#e67e22",
}


def _get_neo4j_driver():
    try:
        from neo4j import GraphDatabase
        return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    except Exception:
        return None


def fetch_topology(highlight_service: str | None = None) -> dict:
    """Query Neo4j for service topology. Returns nodes and edges."""
    driver = _get_neo4j_driver()
    if driver is None:
        return {"nodes": [], "edges": [], "error": "Neo4j driver unavailable"}

    nodes: dict[str, dict] = {}
    edges: list[dict] = []

    try:
        with driver.session() as session:
            # Fetch relationships
            result = session.run(
                "MATCH (a:Service)-[r]->(b:Service) RETURN a.name AS src, type(r) AS rel, b.name AS dst, "
                "a.slo_latency_ms AS src_slo, b.slo_latency_ms AS dst_slo"
            )
            for record in result:
                src, rel, dst = record["src"], record["rel"], record["dst"]
                if src not in nodes:
                    nodes[src] = {"name": src, "status": "unknown"}
                if dst not in nodes:
                    nodes[dst] = {"name": dst, "status": "unknown"}
                edges.append({"src": src, "rel": rel, "dst": dst})

            # Standalone services (no relationships)
            result2 = session.run("MATCH (s:Service) RETURN s.name AS name")
            for record in result2:
                n = record["name"]
                if n not in nodes:
                    nodes[n] = {"name": n, "status": "unknown"}
    except Exception as e:
        return {"nodes": [], "edges": [], "error": str(e)}
    finally:
        driver.close()

    # Mark blast radius if a service is highlighted
    if highlight_service:
        for edge in edges:
            if edge["src"] == highlight_service or edge["dst"] == highlight_service:
                nodes[edge["src"]]["highlight"] = True
                nodes[edge["dst"]]["highlight"] = True

    return {"nodes": list(nodes.values()), "edges": edges}


def apply_health_colors(nodes: list[dict], health_map: dict[str, str]) -> list[dict]:
    """Apply health status colors from a {service: status} map."""
    for node in nodes:
        node["status"] = health_map.get(node["name"], "unknown")
    return nodes


def build_pyvis_html(topology: dict, height: int = 500) -> str:
    """Build pyvis HTML string from topology dict."""
    try:
        from pyvis.network import Network
    except ImportError:
        return "<p>pyvis not installed. Run: pip3 install pyvis --break-system-packages</p>"

    net = Network(height=f"{height}px", width="100%", directed=True, bgcolor="#1e1e2e", font_color="white")
    net.set_options("""
    {
      "nodes": {"font": {"size": 14}},
      "edges": {"arrows": {"to": {"enabled": true, "scaleFactor": 0.8}}, "smooth": {"type": "curvedCW"}},
      "physics": {"stabilization": {"iterations": 100}}
    }
    """)

    for node in topology.get("nodes", []):
        color = NODE_COLORS.get(node.get("status", "unknown"), NODE_COLORS["unknown"])
        if node.get("highlight"):
            color = "#e74c3c"
        net.add_node(node["name"], label=node["name"], color=color, size=25, title=node["name"])

    for edge in topology.get("edges", []):
        color = EDGE_COLORS.get(edge["rel"], "#aaaaaa")
        net.add_edge(edge["src"], edge["dst"], label=edge["rel"], color=color, title=edge["rel"])

    with tempfile.NamedTemporaryFile(suffix=".html", delete=False, mode="w") as f:
        net.save_graph(f.name)
        f.seek(0)
        return open(f.name).read()


def render_topology(topology: dict, height: int = 500) -> None:
    """Render the pyvis graph inside Streamlit."""
    if "error" in topology and topology["error"]:
        st.error(f"Neo4j error: {topology['error']}")
        return
    if not topology.get("nodes"):
        st.info("No topology data found. Run `python graph/seed.py` to seed Neo4j.")
        return

    html = build_pyvis_html(topology, height=height)
    components.html(html, height=height + 20, scrolling=False)
