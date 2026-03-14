"""Infrastructure Topology — interactive Neo4j dependency graph."""

import sys
import os

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from components.graph_viz import (
    fetch_topology,
    apply_health_colors,
    render_topology,
    NODE_COLORS,
)
from components.metrics import fetch_service_metrics, service_status

st.set_page_config(page_title="Dependency Graph — InfraWatch AI", layout="wide")
st.title("🕸️ Infrastructure Dependency Graph")
st.markdown("Interactive Neo4j topology. Node color reflects current health status.")

# ── Controls ──────────────────────────────────────────────────────────

SERVICES = ["api-gateway", "payment-service", "user-service", "order-service", "redis-cache"]

col_highlight, col_height, col_reload = st.columns([2, 2, 1])
with col_highlight:
    highlight = st.selectbox(
        "Highlight blast radius for service",
        ["(none)"] + SERVICES,
    )
with col_height:
    graph_height = st.slider("Graph height (px)", 400, 900, 550, 50)
with col_reload:
    st.markdown("&nbsp;", unsafe_allow_html=True)
    reload = st.button("🔄 Reload", width="stretch")

highlight_service = None if highlight == "(none)" else highlight

# ── Fetch topology + health ───────────────────────────────────────────

with st.spinner("Fetching topology from Neo4j..."):
    topology = fetch_topology(highlight_service=highlight_service)

# Fetch current health for node coloring
health_map: dict[str, str] = {}
with st.spinner("Fetching health from Prometheus..."):
    for svc in SERVICES:
        m = fetch_service_metrics(svc)
        health_map[svc] = service_status(m)

topology["nodes"] = apply_health_colors(topology["nodes"], health_map)

# ── Legend ────────────────────────────────────────────────────────────

st.markdown(
    "**Legend** — "
    "<span style='color:#2ecc71'>🟢 Healthy</span>  "
    "<span style='color:#f39c12'>🟡 Degraded</span>  "
    "<span style='color:#e74c3c'>🔴 Critical</span>  "
    "<span style='color:#95a5a6'>⚪ Unknown</span>",
    unsafe_allow_html=True,
)

# ── Graph ─────────────────────────────────────────────────────────────

render_topology(topology, height=graph_height)

# ── Stats ─────────────────────────────────────────────────────────────

st.divider()
col_nodes, col_edges = st.columns(2)
with col_nodes:
    st.metric("Nodes (services)", len(topology.get("nodes", [])))
with col_edges:
    st.metric("Edges (relationships)", len(topology.get("edges", [])))

if topology.get("edges"):
    st.subheader("Relationships")
    rows = [
        {"From": e["src"], "Relationship": e["rel"], "To": e["dst"]}
        for e in topology["edges"]
    ]
    st.dataframe(rows, use_container_width=True)
