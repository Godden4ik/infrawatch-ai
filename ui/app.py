"""InfraWatch AI — Streamlit Dashboard entry point."""

import json
import urllib.error
import urllib.parse
import urllib.request

import streamlit as st

st.set_page_config(
    page_title="InfraWatch AI",
    page_icon="🔭",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── Connectivity helpers ──────────────────────────────────────────────

PROMETHEUS_URL = "http://localhost:9090"
NEO4J_URL = "bolt://localhost:7687"

SERVICE_PORTS = {
    "api-gateway": 8080,
    "payment-service": 8001,
    "user-service": 8002,
    "order-service": 8003,
    "redis-cache": 8004,
}


def _check_http(url: str, timeout: int = 2) -> bool:
    try:
        urllib.request.urlopen(url, timeout=timeout)
        return True
    except Exception:
        return False


def _check_prometheus() -> bool:
    return _check_http(f"{PROMETHEUS_URL}/-/ready")


def _check_neo4j() -> bool:
    return _check_http("http://localhost:7474")


def _check_service(port: int) -> bool:
    return _check_http(f"http://localhost:{port}/health", timeout=2)


# ── Layout ────────────────────────────────────────────────────────────

st.title("🔭 InfraWatch AI")
st.markdown(
    """
**AI-powered infrastructure monitoring** for PJATK Master's capstone project.
Integrates MCP · LangGraph · GraphRAG for end-to-end DevOps incident management.
"""
)

# Architecture diagram (mermaid via markdown code block — renders in GitHub/docs)
with st.expander("Architecture Overview", expanded=False):
    st.markdown(
        """
```
Prometheus / Grafana ──► Monitor Agent
                               │
                     MCP Servers (Prometheus, Grafana, Neo4j)
                               │
                         Analyst Agent ◄─── Neo4j GraphRAG
                               │
                        Responder Agent
                               │
                      Remediation Plan
```
| Phase | Component | Status |
|-------|-----------|--------|
| 1 | Docker + simulated services | ✅ |
| 2 | MCP servers | ✅ |
| 3 | LangGraph pipeline | ✅ |
| 4 | GraphRAG + runbook ingestion | ✅ |
| 5 | Streamlit UI (this) | ✅ |
"""
    )

st.divider()

# ── System Status ─────────────────────────────────────────────────────

st.subheader("System Status")

col_prom, col_neo4j, *svc_cols = st.columns(2 + len(SERVICE_PORTS))

with col_prom:
    ok = _check_prometheus()
    st.metric("Prometheus", "🟢 Up" if ok else "🔴 Down")

with col_neo4j:
    ok = _check_neo4j()
    st.metric("Neo4j", "🟢 Up" if ok else "🔴 Down")

for col, (svc, port) in zip(svc_cols, SERVICE_PORTS.items()):
    with col:
        ok = _check_service(port)
        st.metric(svc, "🟢" if ok else "🔴")

st.divider()

# ── Navigation ────────────────────────────────────────────────────────

st.subheader("Pages")

c1, c2, c3, c4, c5 = st.columns(5)
with c1:
    st.page_link("pages/1_Dashboard.py", label="📊 Service Health", width="stretch")
with c2:
    st.page_link("pages/2_Anomaly_Injection.py", label="⚡ Anomaly Injection", width="stretch")
with c3:
    st.page_link("pages/3_Pipeline_Results.py", label="🤖 Pipeline Results", width="stretch")
with c4:
    st.page_link("pages/4_Dependency_Graph.py", label="🕸️ Dependency Graph", width="stretch")
with c5:
    st.page_link("pages/5_GraphRAG_Eval.py", label="🔬 GraphRAG Eval", width="stretch")
