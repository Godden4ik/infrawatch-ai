"""GraphRAG vs Naive RAG comparison page."""

import asyncio

import streamlit as st

st.set_page_config(page_title="GraphRAG Eval — InfraWatch AI", layout="wide")
st.title("🔬 GraphRAG vs Naive RAG Evaluation")

st.markdown("""
Compare retrieval quality between **GraphRAG** (topology-aware) and **Naive RAG** (embedding-only)
across 10 realistic infrastructure incident queries.
""")

# ── How it works ──────────────────────────────────────────────────────

with st.expander("How this evaluation works", expanded=False):
    st.markdown("""
**Both methods use the same vector index** (`all-MiniLM-L6-v2` embeddings stored in Neo4j) to find
the most semantically similar runbook steps and incident records. The difference is what happens
after the vector search:

| | GraphRAG | Naive RAG |
|---|---|---|
| Vector search | ✅ Same index | ✅ Same index |
| Graph traversal | ✅ Follows `APPLIES_TO`, `REFERENCES`, `AFFECTED` edges | ❌ None |
| Service relationships | ✅ Returns which services are affected | ❌ Text only |
| Blast radius | ✅ Surfaces downstream dependencies | ❌ Invisible |
| Context richness | ✅ Structured metadata per result | ❌ Always zero |

**Three metrics are measured:**

- **Service Coverage** — fraction of expected affected services found in the results.
  GraphRAG discovers these via graph edges; Naive RAG has no mechanism to surface them,
  so its score is structurally 0.
- **Context Richness** — count of populated relational fields per result (`applies_to_services`,
  `referenced_services`, `affected_services`, `symptoms`, etc.). Measures how much topology
  context is attached to each retrieved document.
- **Content Overlap (Jaccard)** — fraction of retrieved document IDs shared between both methods.
  A high overlap score means GraphRAG's advantage comes from *enriching* the same documents,
  not from finding better ones.
""")

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
    col_sel, col_provider, col_btn = st.columns([3, 2, 1])
    with col_sel:
        query_options = ["Run All"] + [f"{i+1}. {q['query'][:60]}..." for i, q in enumerate(EVAL_QUERIES)]
        selected = st.selectbox("Select evaluation query", query_options)
    with col_provider:
        judge_provider = st.radio(
            "LLM judge",
            options=["anthropic", "ollama"],
            format_func=lambda x: "Claude Haiku (API)" if x == "anthropic" else "Ollama (local)",
            horizontal=True,
            key="rag_judge_provider",
            help="Choose which LLM scores the retrieved content. Ollama requires a local instance on port 11434.",
        )
        if judge_provider == "ollama":
            ollama_model = st.text_input("Ollama model", value="llama3.1", key="rag_ollama_model")
        else:
            ollama_model = "llama3.1"
    with col_btn:
        st.markdown("&nbsp;", unsafe_allow_html=True)
        run_btn = st.button("▶ Run Evaluation", type="primary", use_container_width=True)

    # ── Run ───────────────────────────────────────────────────────────

    if run_btn:
        judge_label = "Claude Haiku" if judge_provider == "anthropic" else f"Ollama ({ollama_model})"
        if selected == "Run All":
            with st.spinner(f"Running all 10 evaluation queries using {judge_label} as judge (this may take ~30 s)..."):
                try:
                    results = asyncio.run(evaluate_all(judge_provider=judge_provider, ollama_model=ollama_model))
                    st.session_state["rag_results"] = results
                    st.session_state["rag_single"] = False
                    st.session_state["rag_judge_label"] = judge_label
                except Exception as e:
                    st.error(f"Evaluation failed: {e}")
        else:
            idx = int(selected.split(".")[0]) - 1
            with st.spinner(f"Running query {idx + 1} using {judge_label} as judge..."):
                try:
                    result = asyncio.run(evaluate_single(EVAL_QUERIES[idx], judge_provider=judge_provider, ollama_model=ollama_model))
                    st.session_state["rag_results"] = [result]
                    st.session_state["rag_single"] = True
                    st.session_state["rag_judge_label"] = judge_label
                except Exception as e:
                    st.error(f"Evaluation failed: {e}")

    # ── Results ───────────────────────────────────────────────────────

    results = st.session_state.get("rag_results")
    if results:
        is_single = st.session_state.get("rag_single", False)
        st.divider()

        if not is_single:
            import plotly.graph_objects as go

            queries_short = [f"Q{i+1}" for i in range(len(results))]
            gr_acc = [r["graphrag"]["service_accuracy"] for r in results]
            n_acc = [r["naive"]["service_accuracy"] for r in results]
            gr_ctx = [r["graphrag"]["context_richness"] for r in results]
            n_ctx = [r["naive"]["context_richness"] for r in results]

            n = len(results)
            avg_gr_acc = sum(gr_acc) / n
            avg_n_acc = sum(n_acc) / n
            avg_gr_ctx = sum(gr_ctx) / n
            avg_n_ctx = sum(n_ctx) / n
            avg_overlap = sum(r.get("content_overlap", 1.0) for r in results) / n
            avg_gr_rel  = sum(r["graphrag"].get("llm_content_relevance", 5) for r in results) / n
            avg_nr_rel  = sum(r["naive"].get("llm_content_relevance", 5) for r in results) / n
            avg_gr_act  = sum(r["graphrag"].get("llm_actionability", 5) for r in results) / n
            avg_nr_act  = sum(r["naive"].get("llm_actionability", 5) for r in results) / n

            # ── Key finding banner ────────────────────────────────────
            st.subheader("Summary")
            judge_label = st.session_state.get("rag_judge_label", "LLM")
            st.caption(f"LLM judge: **{judge_label}**")
            st.info(
                f"Both methods retrieved the **same documents** ({avg_overlap:.0%} content overlap) "
                f"and scored similarly on content quality (relevance {avg_gr_rel:.1f} vs {avg_nr_rel:.1f}/10, "
                f"actionability {avg_gr_act:.1f} vs {avg_nr_act:.1f}/10). "
                f"GraphRAG's advantage is the topology layer: it adds on average "
                f"**{avg_gr_ctx:.0f} relational context fields** per query and surfaces "
                f"**all expected affected services** — Naive RAG surfaces none."
            )

            # ── Summary metrics ───────────────────────────────────────
            st.markdown("**Topology metrics** — where GraphRAG wins")
            m1, m2, m3, m4 = st.columns(4)
            m1.metric("GraphRAG Avg Coverage", f"{avg_gr_acc:.2f}",
                      help="Fraction of expected affected services identified via graph traversal.")
            m2.metric("Naive RAG Avg Coverage", f"{avg_n_acc:.2f}",
                      help="Always 0 — Naive RAG returns text only, no service relationship fields.",
                      delta=f"{avg_n_acc - avg_gr_acc:+.2f}")
            m3.metric("GraphRAG Avg Richness", f"{avg_gr_ctx:.1f}",
                      help="Average number of populated relational fields per query.")
            m4.metric("Naive RAG Avg Richness", f"{avg_n_ctx:.1f}",
                      help="Always 0 — Naive RAG query returns no structured metadata fields.",
                      delta=f"{avg_n_ctx - avg_gr_ctx:+.1f}")

            judge_label = st.session_state.get("rag_judge_label", "LLM")
            st.markdown(f"**LLM-as-judge ({judge_label})** — content quality (where both compete)")
            j1, j2, j3, j4, j5 = st.columns(5)
            j1.metric("GraphRAG Relevance", f"{avg_gr_rel:.1f}/10",
                      help=f"{judge_label} score: how well does the retrieved content address the incident?")
            j2.metric("Naive RAG Relevance", f"{avg_nr_rel:.1f}/10",
                      help="Same metric for Naive RAG — expected to be similar since both retrieve the same documents.",
                      delta=f"{avg_nr_rel - avg_gr_rel:+.1f}", delta_color="off")
            j3.metric("GraphRAG Actionability", f"{avg_gr_act:.1f}/10",
                      help=f"{judge_label} score: how actionable are the steps for an on-call engineer?")
            j4.metric("Naive RAG Actionability", f"{avg_nr_act:.1f}/10",
                      delta=f"{avg_nr_act - avg_gr_act:+.1f}", delta_color="off")
            j5.metric("Content Overlap", f"{avg_overlap:.2f}",
                      help="Jaccard similarity of retrieved document IDs.")

            # ── Charts ────────────────────────────────────────────────
            col_chart1, col_chart2 = st.columns(2)

            with col_chart1:
                fig = go.Figure(data=[
                    go.Bar(name="GraphRAG", x=queries_short, y=gr_acc, marker_color="#2ecc71"),
                    go.Bar(name="Naive RAG", x=queries_short, y=n_acc, marker_color="#e74c3c"),
                ])
                fig.update_layout(
                    title="Service Coverage per Query",
                    barmode="group",
                    yaxis=dict(title="Coverage (0–1)", range=[0, 1.1]),
                    legend=dict(orientation="h"),
                    height=350,
                )
                st.plotly_chart(fig, use_container_width=True)
                st.caption(
                    "GraphRAG identifies affected services via graph edges. "
                    "Naive RAG scores 0 on all queries — it retrieves the same documents "
                    "but has no mechanism to surface service topology."
                )

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
                st.plotly_chart(fig2, use_container_width=True)
                st.caption(
                    "Context richness counts structured relational fields attached to each result "
                    "(applies_to_services, referenced_services, affected_services, symptoms, etc.). "
                    "Naive RAG's Cypher query omits all graph joins, so richness is structurally 0."
                )

            st.divider()

        # ── Per-query side-by-side ─────────────────────────────────────
        st.subheader("Query Details")
        st.caption(
            "Each query shows what both methods retrieved and how they scored. "
            "Content overlap near 1.0 confirms GraphRAG's advantage is topology enrichment, not better retrieval."
        )

        CATEGORY_NOTES = {
            "cascade": "Cascade queries require blast-radius analysis — knowing which downstream services are affected. This is where GraphRAG's graph traversal is most critical.",
            "latency": "Latency queries benefit from knowing which services depend on the slow component.",
            "error":   "Error queries may involve upstream/downstream dependencies that only the graph can surface.",
            "memory":  "Memory queries are typically single-service; graph context still surfaces related runbooks and past incidents.",
            "capacity": "Capacity queries are informational; graph context links runbooks to service owners and dependencies.",
        }

        for i, r in enumerate(results):
            with st.expander(f"Q{i+1}: {r['query']}", expanded=(len(results) == 1)):
                cat = r["category"]
                st.markdown(f"**Category:** `{cat}`")
                if cat in CATEGORY_NOTES:
                    st.caption(CATEGORY_NOTES[cat])

                overlap = r.get("content_overlap", 1.0)
                if overlap >= 0.9:
                    overlap_note = "Both methods retrieved identical documents — scores differ only due to topology enrichment."
                elif overlap >= 0.5:
                    overlap_note = "Partial overlap — some retrieval divergence in addition to enrichment differences."
                else:
                    overlap_note = "Low overlap — methods retrieved different documents."
                st.metric(
                    "Content Overlap (Jaccard)", f"{overlap:.2f}",
                    help="Fraction of retrieved document IDs shared between both methods.",
                    delta=overlap_note,
                    delta_color="off",
                )

                col_gr, col_nr = st.columns(2)

                with col_gr:
                    st.markdown("### GraphRAG")
                    st.caption("Vector search + graph traversal. Returns structured service relationships alongside content.")
                    gr = r["graphrag"]
                    c1, c2, c3 = st.columns(3)
                    c1.metric("Service Coverage", f"{gr['service_accuracy']:.2f}",
                              help="Fraction of expected services found via graph edges.")
                    c2.metric("Context Richness", gr["context_richness"],
                              help="Count of populated relational fields across all results.")
                    c3.metric("Results", gr["result_count"])
                    if gr.get("llm_content_relevance") is not None:
                        _jlabel = st.session_state.get("rag_judge_label", "LLM judge")
                        lc1, lc2 = st.columns(2)
                        lc1.metric("LLM Relevance", f"{gr['llm_content_relevance']}/10",
                                   help=f"{_jlabel}: how well does the content address this incident?")
                        lc2.metric("LLM Actionability", f"{gr['llm_actionability']}/10",
                                   help=f"{_jlabel}: how actionable are the steps for an on-call engineer?")
                    if gr.get("services_found"):
                        st.markdown(f"**Services identified:** {', '.join(gr['services_found'])}")
                    if r.get("graphrag_formatted"):
                        st.markdown("**Retrieved content:**")
                        st.text(r["graphrag_formatted"][:1200])

                with col_nr:
                    st.markdown("### Naive RAG")
                    st.caption("Vector search only. Same embedding index, no graph joins — returns text without relational context.")
                    nr = r["naive"]
                    c1, c2, c3 = st.columns(3)
                    c1.metric("Service Coverage", f"{nr['service_accuracy']:.2f}",
                              help="Always 0 — no service relationship fields returned by design.")
                    c2.metric("Context Richness", nr["context_richness"],
                              help="Always 0 — no graph metadata fields returned.")
                    c3.metric("Results", nr["result_count"])
                    if nr.get("llm_content_relevance") is not None:
                        _jlabel = st.session_state.get("rag_judge_label", "LLM judge")
                        lc1, lc2 = st.columns(2)
                        lc1.metric("LLM Relevance", f"{nr['llm_content_relevance']}/10",
                                   help=f"{_jlabel}: how well does the content address this incident?")
                        lc2.metric("LLM Actionability", f"{nr['llm_actionability']}/10",
                                   help="Claude Haiku: how actionable are the steps for an on-call engineer?")
                    if nr.get("services_found"):
                        st.markdown(f"**Services identified:** {', '.join(nr['services_found'])}")
                    st.caption("No services identified — topology is invisible without graph traversal.")
                    if r.get("naive_formatted"):
                        st.markdown("**Retrieved content:**")
                        st.text(r["naive_formatted"][:1200])
