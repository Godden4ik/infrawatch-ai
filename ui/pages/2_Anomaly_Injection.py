"""Scenario Control Panel — inject anomalies and trigger the agent pipeline."""

import json
import urllib.error
import urllib.request

import streamlit as st

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

# ── Next step ─────────────────────────────────────────────────────────

if st.session_state.get("injection_history"):
    st.divider()
    st.info(
        "**Anomaly injected.** Wait ~60 seconds for Prometheus to scrape the new values, "
        "then run the agent pipeline to detect and analyse the failure."
    )
    st.page_link("pages/3_Pipeline_Results.py", label="▶ Go to Pipeline Results", icon="🤖")

# ── Injection History ─────────────────────────────────────────────────

history = st.session_state.get("injection_history", [])
if history:
    st.divider()
    st.subheader("Injection History (this session)")
    for i, entry in enumerate(reversed(history[-10:]), 1):
        st.markdown(f"**{i}.** {entry['scenario']}")
