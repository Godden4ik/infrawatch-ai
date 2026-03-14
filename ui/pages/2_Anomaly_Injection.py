"""Scenario Control Panel — inject anomalies and trigger the agent pipeline."""

import json
import sys
import os
import urllib.error
import urllib.request

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

st.set_page_config(page_title="Anomaly Injection — InfraWatch AI", layout="wide")
st.title("⚡ Anomaly Injection")
st.markdown("Inject failure scenarios into the simulated microservices, then trigger the agent pipeline.")

SERVICE_PORTS = {
    "api-gateway": 8080,
    "payment-service": 8001,
    "user-service": 8002,
    "order-service": 8003,
    "redis-cache": 8004,
}

ANOMALY_TYPES = [
    "latency",
    "error",
    "memory_leak",
    "cache_failure",
    "cache_degraded",
]


def _inject(service: str, anomaly_type: str | None) -> dict:
    port = SERVICE_PORTS[service]
    param = f"?anomaly_type={anomaly_type}" if anomaly_type else "?anomaly_type=none"
    url = f"http://localhost:{port}/inject{param}"
    req = urllib.request.Request(url, method="POST")
    try:
        resp = urllib.request.urlopen(req, timeout=5)
        return json.loads(resp.read().decode())
    except urllib.error.URLError as e:
        return {"error": str(e), "service": service}


def inject_cascade() -> list[dict]:
    results = []
    results.append({"service": "redis-cache", **_inject("redis-cache", "cache_failure")})
    results.append({"service": "payment-service", **_inject("payment-service", "cache_degraded")})
    results.append({"service": "order-service", **_inject("order-service", "cache_degraded")})
    return results


def reset_all() -> list[dict]:
    return [{"service": svc, **_inject(svc, None)} for svc in SERVICE_PORTS]


# ── Preset Scenarios ──────────────────────────────────────────────────

st.subheader("Preset Scenarios")
col1, col2 = st.columns(2)

with col1:
    if st.button("💥 Inject Cascade Failure", width="stretch", type="primary"):
        with st.spinner("Injecting cascade failure..."):
            results = inject_cascade()
        st.success("Cascade injected: Redis → Payment + Order degraded")
        for r in results:
            st.json(r, expanded=False)
        if "injection_history" not in st.session_state:
            st.session_state["injection_history"] = []
        st.session_state["injection_history"].append(
            {"scenario": "cascade", "results": results}
        )

with col2:
    if st.button("✅ Reset All Services", width="stretch"):
        with st.spinner("Resetting all services..."):
            results = reset_all()
        st.success("All services reset to normal")
        for r in results:
            st.json(r, expanded=False)
        if "injection_history" not in st.session_state:
            st.session_state["injection_history"] = []
        st.session_state["injection_history"].append(
            {"scenario": "reset", "results": results}
        )

st.divider()

# ── Manual Injection ──────────────────────────────────────────────────

st.subheader("Manual Injection")

col_svc, col_type, col_btn = st.columns([2, 2, 1])
with col_svc:
    selected_service = st.selectbox("Service", list(SERVICE_PORTS.keys()))
with col_type:
    selected_anomaly = st.selectbox("Anomaly Type", ANOMALY_TYPES)
with col_btn:
    st.markdown("&nbsp;", unsafe_allow_html=True)
    if st.button("Inject", width="stretch", type="secondary"):
        with st.spinner(f"Injecting {selected_anomaly} into {selected_service}..."):
            result = _inject(selected_service, selected_anomaly)
        if "error" in result:
            st.error(f"Failed: {result['error']}")
        else:
            st.success(f"Injected {selected_anomaly} into {selected_service}")
            st.json(result, expanded=False)
        if "injection_history" not in st.session_state:
            st.session_state["injection_history"] = []
        st.session_state["injection_history"].append(
            {"scenario": f"{selected_anomaly} → {selected_service}", "results": [result]}
        )

st.divider()

# ── Run Agent Pipeline ────────────────────────────────────────────────

st.subheader("Agent Pipeline")
st.markdown(
    "Run the Monitor → Analyst → Responder pipeline. "
    "Results are stored in session state and viewable on the **Pipeline Results** page."
)

col_run, col_hint = st.columns([1, 3])
with col_run:
    run_pipeline = st.button("🤖 Run Pipeline", width="stretch", type="primary")
with col_hint:
    st.caption("Wait ~60 s after injection before running (Prometheus scrape interval).")

if run_pipeline:
    from components.pipeline import run_pipeline_sync
    with st.spinner("Running agent pipeline (this may take 30–90 seconds)..."):
        try:
            result = run_pipeline_sync(verbose=False)
            st.session_state["pipeline_result"] = result
            has = result.get("has_anomalies", False)
            n_anomalies = len(result.get("anomalies", []))
            if has:
                st.warning(f"Pipeline complete — {n_anomalies} anomaly/anomalies detected. See Pipeline Results page.")
            else:
                st.success("Pipeline complete — all services healthy.")
        except Exception as e:
            st.error(f"Pipeline failed: {e}")

# ── Injection History ─────────────────────────────────────────────────

history = st.session_state.get("injection_history", [])
if history:
    st.divider()
    st.subheader("Injection History (this session)")
    for i, entry in enumerate(reversed(history[-10:]), 1):
        st.markdown(f"**{i}.** {entry['scenario']}")
