"""Async pipeline runner and state formatting helpers."""

import asyncio
import os

import streamlit as st

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")


def run_pipeline_sync(verbose: bool = True, llm_provider: str = "anthropic", llm_model: str | None = None) -> dict:
    """Run the async agent pipeline synchronously (bridge for Streamlit)."""
    from agents import run_pipeline
    return asyncio.run(run_pipeline(verbose=verbose, llm_provider=llm_provider, llm_model=llm_model))


def iter_pipeline_events(verbose: bool = False, llm_provider: str = "anthropic", llm_model: str | None = None):
    """Synchronous generator of pipeline events for Streamlit streaming.

    Yields raw event dicts from astream_events. Exhausts when the pipeline
    finishes or the producer thread raises an exception.
    """
    import queue
    import threading

    q: queue.Queue = queue.Queue()

    def _producer() -> None:
        from agents import stream_pipeline

        async def _run() -> None:
            try:
                async for event in stream_pipeline(verbose=verbose, llm_provider=llm_provider, llm_model=llm_model):
                    q.put(event)
            except Exception as exc:
                q.put(exc)
            finally:
                q.put(None)  # sentinel — always signals completion

        asyncio.run(_run())

    threading.Thread(target=_producer, daemon=True).start()

    while True:
        item = q.get(timeout=300)  # 5-minute hard timeout
        if item is None:
            break
        if isinstance(item, Exception):
            raise item
        yield item


# ── Neo4j lookup helpers ──────────────────────────────────────────────

def _neo4j_driver():
    try:
        from neo4j import GraphDatabase
        return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    except Exception:
        return None


def fetch_runbook_details(runbook_id: str) -> dict | None:
    """Fetch full runbook + steps from Neo4j by ID."""
    driver = _neo4j_driver()
    if not driver:
        return None
    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (rb:Runbook {id: $id})
                OPTIONAL MATCH (rb)-[:HAS_STEP]->(s:RunbookStep)
                OPTIONAL MATCH (rb)-[:APPLIES_TO]->(svc:Service)
                RETURN rb.id AS id, rb.title AS title, rb.category AS category,
                       rb.severity AS severity,
                       collect(DISTINCT {num: s.step_number, title: s.title, content: s.content})
                           AS steps,
                       collect(DISTINCT svc.name) AS services
                """,
                id=runbook_id,
            )
            record = result.single()
            return dict(record) if record else None
    except Exception:
        return None
    finally:
        driver.close()


def fetch_incident_details(incident_id: str) -> dict | None:
    """Fetch full incident record from Neo4j by ID."""
    driver = _neo4j_driver()
    if not driver:
        return None
    try:
        with driver.session() as session:
            result = session.run(
                """
                MATCH (inc:Incident {id: $id})
                OPTIONAL MATCH (inc)-[:AFFECTED]->(svc:Service)
                OPTIONAL MATCH (inc)-[:ROOT_CAUSE_IN]->(root:Service)
                OPTIONAL MATCH (inc)-[:RESOLVED_BY]->(rb:Runbook)
                OPTIONAL MATCH (inc)-[:HAD_SYMPTOM]->(sym:Symptom)
                RETURN inc.id AS id, inc.title AS title, inc.severity AS severity,
                       inc.description AS description, inc.root_cause AS root_cause,
                       inc.resolution AS resolution,
                       inc.duration_minutes AS duration_minutes,
                       collect(DISTINCT svc.name) AS affected_services,
                       collect(DISTINCT root.name) AS root_cause_services,
                       collect(DISTINCT rb.id) AS resolved_by_runbooks,
                       collect(DISTINCT sym.name) AS symptoms
                """,
                id=incident_id,
            )
            record = result.single()
            return dict(record) if record else None
    except Exception:
        return None
    finally:
        driver.close()


# ── Table formatters ──────────────────────────────────────────────────

def format_anomalies_table(anomalies: list[dict]) -> list[dict]:
    return [
        {
            "Service": a.get("service", ""),
            "Metric": a.get("metric", ""),
            "Value": a.get("value", ""),
            "Threshold": a.get("threshold", ""),
            "Severity": a.get("severity", ""),
        }
        for a in anomalies
    ]


def format_blast_radius_table(blast_radius: list[dict]) -> list[dict]:
    return [
        {
            "Service": b.get("service", ""),
            "Impact Level": b.get("impact_level", ""),
            "SLO at Risk": b.get("slo_at_risk", ""),
        }
        for b in blast_radius
    ]


# ── Runbook / incident renderers ──────────────────────────────────────

def _render_runbook(rb_ref: dict) -> None:
    rb_id = rb_ref.get("id") or rb_ref.get("runbook_id", "?")
    details = fetch_runbook_details(rb_id)

    label = details["title"] if details else rb_id
    with st.expander(f"📋 {rb_id} — {label}"):
        if not details:
            st.warning("Could not load runbook from Neo4j.")
            return
        cols = st.columns(3)
        cols[0].markdown(f"**Category:** {details.get('category', 'N/A')}")
        cols[1].markdown(f"**Severity:** {details.get('severity', 'N/A')}")
        cols[2].markdown(f"**Applies to:** {', '.join(details.get('services') or []) or 'N/A'}")
        steps = [s for s in (details.get("steps") or []) if s.get("content")]
        steps.sort(key=lambda s: s.get("num") or 0)
        if steps:
            st.markdown("**Steps:**")
            for s in steps:
                num = s.get("num", "")
                title = s.get("title", "")
                content = s.get("content", "")
                st.markdown(f"**{num}. {title}**")
                st.markdown(content)
        else:
            st.info("No steps found.")


def _render_incident(inc_ref: dict) -> None:
    inc_id = inc_ref.get("id") or inc_ref.get("incident_id", "?")
    details = fetch_incident_details(inc_id)

    label = details["title"] if details else inc_id
    with st.expander(f"🚨 {inc_id} — {label}"):
        if not details:
            st.warning("Could not load incident from Neo4j.")
            return
        cols = st.columns(2)
        cols[0].markdown(f"**Severity:** {details.get('severity', 'N/A')}")
        cols[1].markdown(f"**Duration:** {details.get('duration_minutes', 'N/A')} min")

        if details.get("description"):
            st.markdown(f"**Description:** {details['description']}")
        if details.get("root_cause"):
            st.markdown(f"**Root Cause:** {details['root_cause']}")
        if details.get("resolution"):
            st.markdown(f"**Resolution:** {details['resolution']}")

        row2 = st.columns(2)
        affected = ", ".join(details.get("affected_services") or [])
        root_svcs = ", ".join(details.get("root_cause_services") or [])
        if affected:
            row2[0].markdown(f"**Affected:** {affected}")
        if root_svcs:
            row2[1].markdown(f"**Root cause service:** {root_svcs}")

        symptoms = ", ".join(details.get("symptoms") or [])
        if symptoms:
            st.markdown(f"**Symptoms:** {symptoms}")
        runbooks = ", ".join(details.get("resolved_by_runbooks") or [])
        if runbooks:
            st.markdown(f"**Resolved by:** {runbooks}")


# ── Main render ───────────────────────────────────────────────────────

def render_pipeline_results(state: dict) -> None:
    """Render the full pipeline state in three expandable sections."""
    has_anomalies = state.get("has_anomalies", False)

    # ── Monitor ──────────────────────────────────────────────────────
    with st.expander("🔍 Monitor Agent", expanded=True):
        health = state.get("health_summary", "")
        if health:
            st.markdown(health)
        else:
            st.info("No health summary available.")

        anomalies = state.get("anomalies", [])
        if anomalies:
            st.markdown(f"**{len(anomalies)} anomaly/anomalies detected**")
            st.dataframe(format_anomalies_table(anomalies), use_container_width=True)
        elif has_anomalies:
            st.warning("Anomalies flagged but no details parsed.")
        else:
            st.success("No anomalies detected — all services healthy.")

    # ── Analyst ──────────────────────────────────────────────────────
    with st.expander("🔬 Analyst Agent", expanded=has_anomalies):
        root_cause = state.get("root_cause", "")
        confidence = state.get("confidence", 0.0)

        if root_cause:
            st.markdown("**Root Cause**")
            st.markdown(root_cause)
            st.progress(min(confidence, 1.0), text=f"Confidence: {confidence:.0%}")
        else:
            st.info("No root cause analysis available.")

        blast = state.get("blast_radius", [])
        if blast:
            st.markdown("**Blast Radius**")
            st.dataframe(format_blast_radius_table(blast), use_container_width=True)

        runbooks = state.get("relevant_runbooks", [])
        if runbooks:
            st.markdown("**Relevant Runbooks**")
            for rb in runbooks:
                _render_runbook(rb)

        incidents = state.get("similar_incidents", [])
        if incidents:
            st.markdown("**Similar Past Incidents**")
            for inc in incidents:
                _render_incident(inc)

    # ── Responder ────────────────────────────────────────────────────
    with st.expander("🛠️ Responder Agent", expanded=has_anomalies):
        plan = state.get("remediation_plan", "")
        if plan:
            st.markdown(plan)
        else:
            st.info("No remediation plan generated.")
