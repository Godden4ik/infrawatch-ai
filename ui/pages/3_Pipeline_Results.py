"""Agent Pipeline — run the Monitor → Analyst → Responder pipeline with live streaming output."""

import streamlit as st
from components.pipeline import (
    format_anomalies_table,
    format_blast_radius_table,
    render_pipeline_results,
)

st.set_page_config(page_title="Agent Pipeline — InfraWatch AI", layout="wide")
st.title("🤖 Agent Pipeline")

# ── Stepper ───────────────────────────────────────────────────────────

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

# ── LLM Provider selector ─────────────────────────────────────────────

with st.sidebar:
    st.markdown("### LLM Provider")
    llm_provider = st.radio(
        "Agent LLM backend",
        options=["anthropic", "ollama"],
        format_func=lambda x: "Anthropic (Claude Haiku)" if x == "anthropic" else "Ollama (local)",
        key="pipeline_llm_provider",
        help="Anthropic uses the Claude API. Ollama runs a local model — requires Ollama running on localhost:11434.",
    )
    if llm_provider == "ollama":
        ollama_agent_model = st.text_input(
            "Ollama model",
            value="qwen2.5:7b",
            key="pipeline_ollama_model",
            help="Must support structured tool calling. Recommended: qwen2.5:7b, mistral, llama3.2",
        )
        st.warning(
            "**Ollama reliability warning:** This pipeline makes 10+ sequential tool calls requiring precise "
            "structured output. 7B models (including qwen2.5:7b) frequently hallucinate results or ignore "
            "tool outputs. For reliable results use the **Anthropic** backend, or an Ollama model ≥32B "
            "(e.g. `qwen2.5:32b`, `mixtral:8x22b`).",
            icon="⚠️",
        )
    else:
        ollama_agent_model = "qwen2.5:7b"

# ── Run button ────────────────────────────────────────────────────────

col_btn, col_hint = st.columns([1, 4])
with col_btn:
    run_btn = st.button("▶ Run Pipeline", type="primary", use_container_width=True)
with col_hint:
    provider_label = "Claude Haiku" if llm_provider == "anthropic" else "Ollama"
    st.caption(f"Polls live Prometheus metrics, queries Neo4j graph topology, and drafts a remediation plan using **{provider_label}**. Wait ~60 s after anomaly injection.")


# ── Per-agent completed-section renderers ────────────────────────────

def _render_monitor_completed(placeholder, state: dict) -> None:
    with placeholder.container():
        with st.expander("🔍 Monitor Agent ✅", expanded=True):
            health = state.get("health_summary", "")
            if health:
                st.markdown(health)
            anomalies = state.get("anomalies", [])
            if anomalies:
                st.markdown(f"**{len(anomalies)} anomaly/anomalies detected**")
                st.dataframe(format_anomalies_table(anomalies), use_container_width=True)
            elif not state.get("has_anomalies"):
                st.success("No anomalies detected — all services healthy.")


def _render_analyst_completed(placeholder, state: dict) -> None:
    with placeholder.container():
        with st.expander("🔬 Analyst Agent ✅", expanded=True):
            root_cause = state.get("root_cause", "")
            confidence = state.get("confidence", 0.0)
            if root_cause:
                st.markdown("**Root Cause**")
                st.markdown(root_cause)
                st.progress(min(confidence, 1.0), text=f"Confidence: {confidence:.0%}")
            blast = state.get("blast_radius", [])
            if blast:
                st.markdown("**Blast Radius**")
                st.dataframe(format_blast_radius_table(blast), use_container_width=True)


def _render_responder_completed(placeholder, state: dict) -> None:
    with placeholder.container():
        with st.expander("🛠️ Responder Agent ✅", expanded=True):
            plan = state.get("remediation_plan", "")
            if plan:
                st.markdown(plan)


# ── Streaming execution ───────────────────────────────────────────────

NODE_NAMES = {"monitor", "analyst", "responder"}
ICONS = {"monitor": "🔍", "analyst": "🔬", "responder": "🛠️"}
NODE_PROGRESS = {
    "monitor":   (0.05, 0.33),
    "analyst":   (0.38, 0.66),
    "responder": (0.71, 1.00),
}
NODE_RENDER = {
    "monitor":   _render_monitor_completed,
    "analyst":   _render_analyst_completed,
    "responder": _render_responder_completed,
}

if run_btn:
    from components.pipeline import iter_pipeline_events
    llm_provider = st.session_state.get("pipeline_llm_provider", "anthropic")
    llm_model = st.session_state.get("pipeline_ollama_model") if llm_provider == "ollama" else None

    status_bar   = st.empty()
    progress_bar = st.progress(0, text="Starting pipeline...")

    # One persistent placeholder per agent — never cleared on agent switch
    monitor_out   = st.empty()
    analyst_out   = st.empty()
    responder_out = st.empty()

    agent_placeholders = {
        "monitor":   monitor_out,
        "analyst":   analyst_out,
        "responder": responder_out,
    }

    current_agent: str | None = None
    agent_tokens: dict[str, str] = {"monitor": "", "analyst": "", "responder": ""}
    partial_state: dict = {}
    node_visit_count: dict[str, int] = {"monitor": 0, "analyst": 0, "responder": 0}
    rerun_banner = st.empty()  # shown only when analyst re-routes to monitor

    try:
        for event in iter_pipeline_events(llm_provider=llm_provider, llm_model=llm_model):
            etype = event.get("event", "")
            ename = event.get("name", "")

            # ── Node started ──────────────────────────────────────────
            if etype == "on_chain_start" and ename in NODE_NAMES:
                current_agent = ename
                node_visit_count[ename] += 1
                icon = ICONS[ename]
                prog, _ = NODE_PROGRESS[ename]
                if ename == "monitor" and node_visit_count["monitor"] > 1:
                    confidence = partial_state.get("confidence", 0.0)
                    rerun_banner.warning(
                        f"🔁 **Low confidence ({confidence:.0%}) — re-running Monitor Agent** "
                        f"(iteration {node_visit_count['monitor']})"
                    )
                    # Reset monitor token buffer for the new pass
                    agent_tokens["monitor"] = ""
                else:
                    rerun_banner.empty()
                status_bar.info(f"{icon} **{ename.capitalize()} Agent** — running...")
                progress_bar.progress(prog, text=f"{icon} {ename.capitalize()} Agent running...")

            # ── Tool called ───────────────────────────────────────────
            elif etype == "on_tool_start" and current_agent:
                icon = ICONS.get(current_agent, "")
                input_data = event.get("data", {}).get("input", {})
                arg_hint = str(next(iter(input_data.values()), ""))[:60] if input_data else ""
                status_bar.info(f"{icon} **{current_agent.capitalize()} Agent** → `{ename}({arg_hint})`")

            # ── Token stream ──────────────────────────────────────────
            elif etype == "on_chat_model_stream" and current_agent:
                chunk = event.get("data", {}).get("chunk")
                if chunk:
                    content = chunk.content
                    text = ""
                    if isinstance(content, str):
                        text = content
                    elif isinstance(content, list):
                        for block in content:
                            if isinstance(block, dict) and block.get("type") == "text":
                                text += block.get("text", "")
                    if text:
                        agent_tokens[current_agent] += text
                        icon = ICONS[current_agent]
                        agent_placeholders[current_agent].markdown(
                            f"**{icon} {current_agent.capitalize()} Agent** (generating...)\n\n"
                            f"{agent_tokens[current_agent]}▌"
                        )

            # ── Node finished — render completed section in-place ─────
            elif etype == "on_chain_end" and ename in NODE_NAMES:
                output = event.get("data", {}).get("output", {})
                partial_state.update({k: v for k, v in output.items() if k != "messages"})
                _, prog = NODE_PROGRESS[ename]
                progress_bar.progress(prog, text=f"✅ {ename.capitalize()} Agent complete")
                NODE_RENDER[ename](agent_placeholders[ename], partial_state)

    except Exception as e:
        status_bar.error(f"Pipeline error: {e}")
        st.stop()

    progress_bar.empty()
    n = len(partial_state.get("anomalies", []))
    if partial_state.get("has_anomalies"):
        status_bar.error(f"⚠️ {n} anomaly/anomalies detected across services")
    else:
        status_bar.success("✅ All services healthy")
    st.session_state["pipeline_result"] = partial_state
    st.stop()  # Keep the rendered per-agent sections visible; don't fall through to results view

# ── Results display (shown on revisit, not during live run) ──────────

state = st.session_state.get("pipeline_result")

if state is None:
    st.info("Click **▶ Run Pipeline** above to start the agent pipeline.")
else:
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
        safe_state = {k: v for k, v in state.items() if k != "messages"}
        st.json(safe_state)

    if st.button("Clear Results"):
        del st.session_state["pipeline_result"]
        st.rerun()
