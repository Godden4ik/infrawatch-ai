"""Service Health Dashboard — real-time Prometheus metrics per service."""

import time

import streamlit as st
from components.metrics import (
    SERVICE_PORTS as _PORTS,
    fetch_service_metrics,
    render_metric_card,
    service_status,
    STATUS_EMOJI,
)

st.set_page_config(page_title="Service Health — InfraWatch AI", layout="wide")
st.title("📊 Service Health Dashboard")

SERVICES = list(_PORTS.keys())

# ── Controls ──────────────────────────────────────────────────────────

col_refresh, col_auto, col_interval = st.columns([1, 1, 2])
with col_refresh:
    manual_refresh = st.button("🔄 Refresh Now", width="stretch")
with col_auto:
    auto_refresh = st.toggle("Auto-refresh", value=False)
with col_interval:
    interval = st.slider("Interval (s)", min_value=5, max_value=60, value=15, step=5)

st.divider()

# ── Fetch metrics ─────────────────────────────────────────────────────

with st.spinner("Fetching metrics from Prometheus..."):
    all_metrics = [fetch_service_metrics(svc) for svc in SERVICES]

# ── Status summary bar ────────────────────────────────────────────────

statuses = [service_status(m) for m in all_metrics]
n_green = statuses.count("green")
n_yellow = statuses.count("yellow")
n_red = statuses.count("red")
n_unknown = statuses.count("unknown")

summary_cols = st.columns(4)
with summary_cols[0]:
    st.metric("🟢 Healthy", n_green)
with summary_cols[1]:
    st.metric("🟡 Degraded", n_yellow)
with summary_cols[2]:
    st.metric("🔴 Critical", n_red)
with summary_cols[3]:
    st.metric("⚪ Unknown", n_unknown)

st.divider()

# ── Per-service cards ─────────────────────────────────────────────────

cols = st.columns(len(SERVICES))
for col, metrics in zip(cols, all_metrics):
    with col:
        render_metric_card(metrics)

# ── Auto-refresh ──────────────────────────────────────────────────────

if auto_refresh:
    time.sleep(interval)
    st.rerun()
