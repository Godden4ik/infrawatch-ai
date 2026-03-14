"""Agent Pipeline Results — Monitor → Analyst → Responder output viewer."""

import sys
import os

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from components.pipeline import render_pipeline_results

st.set_page_config(page_title="Pipeline Results — InfraWatch AI", layout="wide")
st.title("🤖 Pipeline Results")

# ── Pipeline stepper ──────────────────────────────────────────────────

step_cols = st.columns(5)
labels = ["Monitor", "→", "Analyst", "→", "Responder"]
icons = ["🔍", "", "🔬", "", "🛠️"]
for col, label, icon in zip(step_cols, labels, icons):
    with col:
        if label == "→":
            st.markdown("<div style='text-align:center;font-size:2em;padding-top:10px'>→</div>", unsafe_allow_html=True)
        else:
            st.markdown(
                f"<div style='text-align:center;border:1px solid #555;border-radius:8px;padding:8px'>"
                f"<b>{icon} {label}</b></div>",
                unsafe_allow_html=True,
            )

st.divider()

# ── Result display ────────────────────────────────────────────────────

state = st.session_state.get("pipeline_result")

if state is None:
    st.info(
        "No pipeline result yet. Go to **Anomaly Injection** page and click **Run Pipeline**."
    )
else:
    # Summary banner
    has = state.get("has_anomalies", False)
    n = len(state.get("anomalies", []))
    if has:
        st.error(f"**{n} anomaly/anomalies detected** — see details below.")
    else:
        st.success("**All services healthy** — no anomalies at last run.")

    render_pipeline_results(state)

    st.divider()

    with st.expander("Raw State (JSON)", expanded=False):
        import json
        # Serialize state (messages contain non-serializable objects)
        safe_state = {
            k: v
            for k, v in state.items()
            if k != "messages"
        }
        st.json(safe_state)

# ── Clear button ──────────────────────────────────────────────────────

if state is not None:
    if st.button("Clear Results"):
        del st.session_state["pipeline_result"]
        st.rerun()
