"""GraphRAG vs Naive RAG comparison page."""

import asyncio
import sys
import os

import streamlit as st

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

st.set_page_config(page_title="GraphRAG Eval — InfraWatch AI", layout="wide")
st.title("🔬 GraphRAG vs Naive RAG Evaluation")
st.markdown(
    "Compare retrieval quality between **GraphRAG** (topology-aware) and **Naive RAG** (embedding-only)."
)

# ── Import eval logic ─────────────────────────────────────────────────

try:
    from scripts.evaluate_rag import (
        EVAL_QUERIES,
        evaluate_single,
        evaluate_all,
        score_results,
    )
    eval_available = True
except ImportError as e:
    eval_available = False
    st.error(f"Could not import evaluation module: {e}")

# ── Controls ──────────────────────────────────────────────────────────

if eval_available:
    query_options = ["Run All"] + [f"{i+1}. {q['query'][:60]}..." for i, q in enumerate(EVAL_QUERIES)]
    selected = st.selectbox("Select evaluation query", query_options)

    run_btn = st.button("▶ Run Evaluation", type="primary")

    # ── Run ───────────────────────────────────────────────────────────

    if run_btn:
        if selected == "Run All":
            with st.spinner("Running all 10 evaluation queries (this may take ~30 s)..."):
                try:
                    results = asyncio.run(evaluate_all())
                    st.session_state["rag_results"] = results
                    st.session_state["rag_single"] = False
                except Exception as e:
                    st.error(f"Evaluation failed: {e}")
        else:
            idx = int(selected.split(".")[0]) - 1
            with st.spinner(f"Running query {idx + 1}..."):
                try:
                    result = asyncio.run(evaluate_single(EVAL_QUERIES[idx]))
                    st.session_state["rag_results"] = [result]
                    st.session_state["rag_single"] = True
                except Exception as e:
                    st.error(f"Evaluation failed: {e}")

    # ── Results ───────────────────────────────────────────────────────

    results = st.session_state.get("rag_results")
    if results:
        is_single = st.session_state.get("rag_single", False)
        st.divider()

        if not is_single:
            # ── Summary bar chart ──────────────────────────────────────
            import plotly.graph_objects as go

            queries_short = [f"Q{i+1}" for i in range(len(results))]
            gr_acc = [r["graphrag"]["service_accuracy"] for r in results]
            n_acc = [r["naive"]["service_accuracy"] for r in results]
            gr_ctx = [r["graphrag"]["context_richness"] for r in results]
            n_ctx = [r["naive"]["context_richness"] for r in results]

            col_chart1, col_chart2 = st.columns(2)

            with col_chart1:
                fig = go.Figure(data=[
                    go.Bar(name="GraphRAG", x=queries_short, y=gr_acc, marker_color="#2ecc71"),
                    go.Bar(name="Naive RAG", x=queries_short, y=n_acc, marker_color="#e74c3c"),
                ])
                fig.update_layout(
                    title="Service Accuracy per Query",
                    barmode="group",
                    yaxis=dict(title="Accuracy", range=[0, 1.1]),
                    legend=dict(orientation="h"),
                    height=350,
                )
                st.plotly_chart(fig, width="stretch")

            with col_chart2:
                fig2 = go.Figure(data=[
                    go.Bar(name="GraphRAG", x=queries_short, y=gr_ctx, marker_color="#3498db"),
                    go.Bar(name="Naive RAG", x=queries_short, y=n_ctx, marker_color="#e67e22"),
                ])
                fig2.update_layout(
                    title="Context Richness per Query",
                    barmode="group",
                    yaxis=dict(title="Richness score"),
                    legend=dict(orientation="h"),
                    height=350,
                )
                st.plotly_chart(fig2, width="stretch")

            # Summary metrics
            n = len(results)
            avg_gr_acc = sum(gr_acc) / n
            avg_n_acc = sum(n_acc) / n
            avg_gr_ctx = sum(gr_ctx) / n
            avg_n_ctx = sum(n_ctx) / n

            m1, m2, m3, m4 = st.columns(4)
            m1.metric("GraphRAG Avg Accuracy", f"{avg_gr_acc:.2f}")
            m2.metric("Naive RAG Avg Accuracy", f"{avg_n_acc:.2f}", delta=f"{avg_gr_acc - avg_n_acc:+.2f}")
            m3.metric("GraphRAG Avg Richness", f"{avg_gr_ctx:.1f}")
            m4.metric("Naive RAG Avg Richness", f"{avg_n_ctx:.1f}", delta=f"{avg_gr_ctx - avg_n_ctx:+.1f}")

            st.caption(
                f"GraphRAG provides {avg_gr_ctx / max(avg_n_ctx, 0.1):.1f}x richer context on average."
            )

            st.divider()

        # ── Per-query side-by-side ─────────────────────────────────────
        st.subheader("Query Details")

        for i, r in enumerate(results):
            with st.expander(f"Q{i+1}: {r['query'][:70]}...", expanded=(len(results) == 1)):
                st.markdown(f"**Category:** `{r['category']}`")

                col_gr, col_nr = st.columns(2)

                with col_gr:
                    st.markdown("### GraphRAG")
                    gr = r["graphrag"]
                    st.metric("Service Accuracy", f"{gr['service_accuracy']:.2f}")
                    st.metric("Context Richness", gr["context_richness"])
                    st.metric("Result Count", gr["result_count"])
                    if gr.get("services_found"):
                        st.markdown(f"**Services found:** {', '.join(gr['services_found'])}")
                    if r.get("graphrag_formatted"):
                        st.markdown("**Retrieved content:**")
                        st.text(r["graphrag_formatted"][:1000])

                with col_nr:
                    st.markdown("### Naive RAG")
                    nr = r["naive"]
                    st.metric("Service Accuracy", f"{nr['service_accuracy']:.2f}")
                    st.metric("Context Richness", nr["context_richness"])
                    st.metric("Result Count", nr["result_count"])
                    if nr.get("services_found"):
                        st.markdown(f"**Services found:** {', '.join(nr['services_found'])}")
                    if r.get("naive_formatted"):
                        st.markdown("**Retrieved content:**")
                        st.text(r["naive_formatted"][:1000])
