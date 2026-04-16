"""GraphRAG and Naive RAG retrieval functions for InfraWatch knowledge base.

GraphRAG: vector search + graph traversal for context-rich results.
Naive RAG: vector search only — flat text results without graph context.
"""

import asyncio
import os

from dotenv import load_dotenv
from neo4j import AsyncGraphDatabase
from sentence_transformers import SentenceTransformer

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


async def _embed(text: str) -> list[float]:
    """Generate 384-dim embedding via all-MiniLM-L6-v2 (local, run in thread pool)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: _get_model().encode(text).tolist())


def _make_driver():
    return AsyncGraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


# ── GraphRAG retrieval ───────────────────────────────────────────────

GRAPHRAG_RUNBOOK_QUERY = """
CALL db.index.vector.queryNodes('runbook_step_embedding', $k, $embedding)
YIELD node AS step, score
MATCH (rb:Runbook)-[:HAS_STEP]->(step)
OPTIONAL MATCH (rb)-[:APPLIES_TO]->(svc:Service)
OPTIONAL MATCH (step)-[:REFERENCES]->(ref:Service)
OPTIONAL MATCH (svc)-[dep:DEPENDS_ON|CALLS|ROUTES_TO]->(downstream:Service)
RETURN step.content AS content,
       step.title AS step_title,
       rb.id AS runbook_id,
       rb.title AS runbook_title,
       rb.category AS category,
       rb.severity AS severity,
       collect(DISTINCT svc.name) AS applies_to_services,
       collect(DISTINCT ref.name) AS referenced_services,
       collect(DISTINCT downstream.name) AS downstream_dependencies,
       score
ORDER BY score DESC
"""

GRAPHRAG_INCIDENT_QUERY = """
CALL db.index.vector.queryNodes('incident_embedding', $k, $embedding)
YIELD node AS inc, score
OPTIONAL MATCH (inc)-[:AFFECTED]->(affected:Service)
OPTIONAL MATCH (inc)-[:ROOT_CAUSE_IN]->(root:Service)
OPTIONAL MATCH (inc)-[:RESOLVED_BY]->(rb:Runbook)
OPTIONAL MATCH (inc)-[:HAD_SYMPTOM]->(sym:Symptom)
OPTIONAL MATCH (root)-[dep:DEPENDS_ON|CALLS|ROUTES_TO]->(downstream:Service)
RETURN inc.id AS incident_id,
       inc.title AS title,
       inc.severity AS severity,
       inc.root_cause AS root_cause,
       inc.resolution AS resolution,
       inc.description AS description,
       inc.duration_minutes AS duration_minutes,
       collect(DISTINCT affected.name) AS affected_services,
       collect(DISTINCT root.name) AS root_cause_services,
       collect(DISTINCT rb.id) AS resolved_by_runbooks,
       collect(DISTINCT sym.name) AS symptoms,
       collect(DISTINCT downstream.name) AS root_cause_dependencies,
       score
ORDER BY score DESC
"""

GRAPHRAG_SERVICE_CONTEXT_QUERY = """
MATCH (svc:Service {name: $service_name})
OPTIONAL MATCH (rb:Runbook)-[:APPLIES_TO]->(svc)
OPTIONAL MATCH (inc:Incident)-[:AFFECTED]->(svc)
OPTIONAL MATCH (inc2:Incident)-[:ROOT_CAUSE_IN]->(svc)
OPTIONAL MATCH (svc)-[r]->(downstream:Service)
OPTIONAL MATCH (upstream:Service)-[r2]->(svc)
RETURN svc.name AS service,
       svc.type AS type,
       svc.owner AS owner,
       svc.slo_latency_ms AS slo_latency_ms,
       collect(DISTINCT rb.id) AS runbooks,
       collect(DISTINCT inc.id) AS incidents_affected,
       collect(DISTINCT inc2.id) AS incidents_root_cause,
       collect(DISTINCT {name: downstream.name, rel: type(r)}) AS downstream,
       collect(DISTINCT {name: upstream.name, rel: type(r2)}) AS upstream
"""

# ── Chunk retrieval ──────────────────────────────────────────────────

GRAPHRAG_CHUNK_QUERY = """
CALL db.index.vector.queryNodes('knowledge_chunk_embedding', $k, $embedding)
YIELD node AS chunk, score
MATCH (nd:NoiseDocument)-[:HAS_CHUNK]->(chunk)
OPTIONAL MATCH (nd)-[:APPLIES_TO]->(svc:Service)
RETURN chunk.id AS chunk_id,
       chunk.chunk_index AS chunk_index,
       chunk.content AS content,
       nd.id AS document_id,
       nd.title AS document_title,
       nd.source_system AS source_system,
       collect(DISTINCT svc.name) AS related_services,
       score
ORDER BY score DESC
"""

NAIVE_CHUNK_QUERY = """
CALL db.index.vector.queryNodes('knowledge_chunk_embedding', $k, $embedding)
YIELD node AS chunk, score
MATCH (nd:NoiseDocument)-[:HAS_CHUNK]->(chunk)
RETURN chunk.id AS chunk_id,
       chunk.content AS content,
       nd.title AS document_title,
       score
ORDER BY score DESC
"""

# ── Naive RAG retrieval ──────────────────────────────────────────────

NAIVE_RUNBOOK_QUERY = """
CALL db.index.vector.queryNodes('runbook_step_embedding', $k, $embedding)
YIELD node AS step, score
MATCH (rb:Runbook)-[:HAS_STEP]->(step)
RETURN step.content AS content,
       step.title AS step_title,
       rb.id AS runbook_id,
       rb.title AS runbook_title,
       score
ORDER BY score DESC
"""

NAIVE_INCIDENT_QUERY = """
CALL db.index.vector.queryNodes('incident_embedding', $k, $embedding)
YIELD node AS inc, score
RETURN inc.id AS incident_id,
       inc.title AS title,
       inc.description AS description,
       inc.root_cause AS root_cause,
       inc.resolution AS resolution,
       score
ORDER BY score DESC
"""


async def graphrag_retrieve(
    query: str,
    service_context: str | None = None,
    top_k: int = 5,
) -> dict:
    """GraphRAG retrieval: vector search + graph traversal for rich context.

    Returns:
        {
            "runbook_results": [...],
            "incident_results": [...],
            "service_context": {...} | None,
        }
    """
    embedding = await _embed(query)
    driver = _make_driver()

    try:
        async with driver.session() as session:
            # Vector search runbook steps + graph expansion
            result = await session.run(
                GRAPHRAG_RUNBOOK_QUERY, k=top_k, embedding=embedding
            )
            runbook_results = [dict(r) async for r in result]

            # Vector search incidents + graph expansion
            result = await session.run(
                GRAPHRAG_INCIDENT_QUERY, k=top_k, embedding=embedding
            )
            incident_results = [dict(r) async for r in result]

            # Optional: direct graph context for a specific service
            svc_context = None
            if service_context:
                result = await session.run(
                    GRAPHRAG_SERVICE_CONTEXT_QUERY, service_name=service_context
                )
                rec = await result.single()
                if rec:
                    svc_context = dict(rec)

            # Chunk search — surfaces noise docs with no service relationships
            result = await session.run(
                GRAPHRAG_CHUNK_QUERY, k=top_k, embedding=embedding
            )
            chunk_results = [dict(r) async for r in result]

        return {
            "runbook_results": runbook_results,
            "incident_results": incident_results,
            "service_context": svc_context,
            "chunk_results": chunk_results,
        }
    finally:
        await driver.close()


async def naive_rag_retrieve(
    query: str,
    top_k: int = 5,
) -> dict:
    """Naive RAG retrieval: vector search only — no graph traversal.

    Returns:
        {
            "runbook_results": [...],
            "incident_results": [...],
        }
    """
    embedding = await _embed(query)
    driver = _make_driver()

    try:
        async with driver.session() as session:
            result = await session.run(
                NAIVE_RUNBOOK_QUERY, k=top_k, embedding=embedding
            )
            runbook_results = [dict(r) async for r in result]

            result = await session.run(
                NAIVE_INCIDENT_QUERY, k=top_k, embedding=embedding
            )
            incident_results = [dict(r) async for r in result]

            # Chunk search — no service context, flat similarity only
            result = await session.run(
                NAIVE_CHUNK_QUERY, k=top_k, embedding=embedding
            )
            chunk_results = [dict(r) async for r in result]

        return {
            "runbook_results": runbook_results,
            "incident_results": incident_results,
            "chunk_results": chunk_results,
        }
    finally:
        await driver.close()
