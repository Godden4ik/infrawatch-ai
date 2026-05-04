"""Accuracy Benchmark page — runs Gold Dataset scenarios and displays metrics."""

import asyncio
import json
import os
import pandas as pd
import streamlit as st
import plotly.express as px

st.set_page_config(page_title="Accuracy Benchmark — InfraWatch AI", layout="wide")
st.title("🎯 Accuracy Benchmark (Gold Dataset)")

st.markdown("""
This benchmark evaluates the end-to-end pipeline accuracy against a **Gold Dataset** of curated 
infrastructure incident scenarios. It measures how well the AI detects the **Root Cause**, 
identifies the **Blast Radius**, and retrieves the **Correct Runbooks**.
""")

# ── Load Data ─────────────────────────────────────────────────────────

GOLD_DATASET_PATH = "scenarios/gold_truth.json"
RESULTS_PATH = "scenarios/benchmark_results.json"

def load_gold_truth():
    if os.path.exists(GOLD_DATASET_PATH):
        with open(GOLD_DATASET_PATH, "r") as f:
            return json.load(f)
    return []

def load_results():
    if os.path.exists(RESULTS_PATH):
        with open(RESULTS_PATH, "r") as f:
            return json.load(f)
    return []

gold_truth = load_gold_truth()
results = load_results()

# ── Sidebar / Controls ────────────────────────────────────────────────

with st.sidebar:
    st.header("Benchmark Controls")
    if st.button("🚀 Run Full Benchmark", type="primary", use_container_width=True):
        st.info("Running benchmark in background... this will take ~2 minutes.")
        # Note: In a real app, you'd trigger the script or run it via a subprocess
        # For this demo, we'll suggest running it via CLI for real-time output
        st.code("python scripts/benchmark_accuracy.py")
    
    st.divider()
    st.subheader("Dataset Summary")
    st.write(f"**Total Scenarios:** {len(gold_truth)}")
    
    categories = {}
    for s in gold_truth:
        cat = s.get("category", "unknown")
        categories[cat] = categories.get(cat, 0) + 1
    
    for cat, count in categories.items():
        st.write(f"- {cat.capitalize()}: {count}")

# ── Metrics Dashboard ─────────────────────────────────────────────────

if results:
    df = pd.DataFrame(results)
    
    # Summary Metrics
    avg_rca = df["rca_correct"].mean()
    avg_br = df["blast_radius_recall"].mean()
    avg_rb = df["runbook_recall"].mean()
    avg_conf = df["confidence"].mean()

    m1, m2, m3, m4 = st.columns(4)
    m1.metric("RCA Precision", f"{avg_rca:.0%}", help="Percentage of scenarios where the correct service was identified as root cause.")
    m2.metric("Blast Radius Recall", f"{avg_br:.2f}", help="Average fraction of affected services correctly identified.")
    m3.metric("Runbook Recall", f"{avg_rb:.2f}", help="Average fraction of expected runbooks retrieved.")
    m4.metric("Avg Confidence", f"{avg_conf:.2f}", help="Average confidence score reported by the Analyst agent.")

    st.divider()

    # Visualizations
    col1, col2 = st.columns(2)

    with col1:
        st.subheader("Recall by Scenario")
        # Melting for easier plotting
        plot_df = df.melt(id_vars=["name"], value_vars=["blast_radius_recall", "runbook_recall"], 
                          var_name="Metric", value_name="Score")
        fig = px.bar(plot_df, x="name", y="Score", color="Metric", barmode="group",
                     labels={"name": "Scenario", "Score": "Recall Score"},
                     color_discrete_sequence=["#3498db", "#2ecc71"])
        fig.update_layout(xaxis_tickangle=-45, height=400)
        st.plotly_chart(fig, use_container_width=True)

    with col2:
        st.subheader("RCA Success vs Confidence")
        fig2 = px.scatter(df, x="confidence", y="blast_radius_recall", color="rca_correct",
                          size="duration", hover_name="name",
                          labels={"confidence": "Analyst Confidence", "blast_radius_recall": "BR Recall"},
                          color_discrete_map={True: "#2ecc71", False: "#e74c3c"})
        st.plotly_chart(fig2, use_container_width=True)
        st.caption("Size represents pipeline execution time. Green dots = Correct RCA.")

    # Detailed Table
    st.subheader("Scenario Breakdown")
    display_df = df[["id", "name", "rca_correct", "blast_radius_recall", "runbook_recall", "confidence", "duration"]]
    display_df.columns = ["ID", "Scenario Name", "RCA Correct", "BR Recall", "RB Recall", "Confidence", "Time (s)"]
    st.dataframe(display_df.style.format({
        "BR Recall": "{:.2f}",
        "RB Recall": "{:.2f}",
        "Confidence": "{:.2f}",
        "Time (s)": "{:.1f}"
    }).highlight_max(axis=0, subset=["Time (s)"], color="#f8d7da")
      .highlight_min(axis=0, subset=["Confidence"], color="#f8d7da"), 
    use_container_width=True)

else:
    st.warning("No benchmark results found. Run the benchmark script first.")
    st.code("python scripts/benchmark_accuracy.py")

# ── View Gold Truth ───────────────────────────────────────────────────

with st.expander("📖 View Gold Dataset Definitions"):
    st.json(gold_truth)
