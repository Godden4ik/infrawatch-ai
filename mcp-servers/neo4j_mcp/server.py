"""Neo4j MCP Server — exposes Cypher queries, topology traversal, and GraphRAG tools for agents."""

import asyncio
import json
import os

from neo4j import AsyncGraphDatabase
from mcp.server.fastmcp import FastMCP
from sentence_transformers import SentenceTransformer

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")

mcp = FastMCP(
    name="neo4j-mcp",
    instructions=(
        "Neo4j graph database server for InfraWatch infrastructure topology and knowledge base. "
        "Schema: Service nodes (name, type, port, owner, slo_latency_ms, slo_error_rate, description), "
        "Infrastructure nodes (name, type), Runbook nodes (id, title, category, severity), "
        "RunbookStep nodes (id, step_number, title, content, embedding), "
        "Incident nodes (id, title, severity, root_cause, resolution, description, embedding), "
        "Symptom nodes (id, name, description, metric_pattern). "
        "Relationships: ROUTES_TO, DEPENDS_ON, CALLS, RUNS_ON, DEPLOYED_IN, "
        "APPLIES_TO, HAS_STEP, REFERENCES, AFFECTED, ROOT_CAUSE_IN, RESOLVED_BY, HAD_SYMPTOM, MANIFESTS_IN. "
        "Services: api-gateway, payment-service, user-service, order-service, redis-cache. "
        "Use search_runbooks and find_similar_incidents for GraphRAG-powered knowledge retrieval."
    ),
)

EMBEDDING_MODEL = "all-MiniLM-L6-v2"

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


async def _embed(text: str) -> list[float]:
    """Generate a 384-dim embedding via all-MiniLM-L6-v2 (local, run in thread pool)."""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, lambda: _get_model().encode(text).tolist())

def _make_driver():
    return AsyncGraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))


def _serialize_value(value):
    """Convert Neo4j types to JSON-serializable Python types."""
    if hasattr(value, "items"):  # Node
        return {"labels": list(value.labels), "properties": dict(value)}
    if hasattr(value, "type"):  # Relationship
        return {"type": value.type, "properties": dict(value)}
    if isinstance(value, list):
        return [_serialize_value(v) for v in value]
    return value


def _serialize_record(record):
    """Convert a Neo4j record to a JSON-serializable dict."""
    return {key: _serialize_value(record[key]) for key in record.keys()}


@mcp.tool()
async def run_cypher(
    query: str,
    params: dict | str | None = None,
) -> str:
    """Execute a Cypher query against the Neo4j infrastructure topology graph.

    `params` accepts either a dict (preferred) or a JSON string,
    e.g. {"name": "redis-cache"} or '{"name": "redis-cache"}'.
    """
    driver = _make_driver()
    parsed_params: dict = {}
    if isinstance(params, dict):
        parsed_params = params
    elif isinstance(params, str) and params:
        try:
            parsed_params = json.loads(params)
        except json.JSONDecodeError as e:
            return json.dumps({"error": f"Invalid JSON params: {e}"})

    try:
        async with driver.session() as session:
            result = await session.run(query, parsed_params)
            records = [_serialize_record(r) async for r in result]
            return json.dumps(records, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def get_service_dependencies(
    service_name: str,
    direction: str = "downstream",
    max_depth: int = 3,
) -> str:
    """Traverse the service dependency graph.

    `direction`:
      - 'downstream': what does this service depend on (outgoing DEPENDS_ON, CALLS, ROUTES_TO)
      - 'upstream': what depends on this service (incoming relationships)

    `max_depth`: maximum hops to traverse (default 3).
    """
    depth = int(max_depth)
    if direction == "downstream":
        cypher = (
            f"MATCH path = (s:Service {{name: $name}})-[*1..{depth}]->(t:Service) "
            "RETURN [n IN nodes(path) | n.name] AS services, "
            "[r IN relationships(path) | type(r)] AS relationships, "
            "length(path) AS depth"
        )
    elif direction == "upstream":
        cypher = (
            f"MATCH path = (t:Service)-[*1..{depth}]->(s:Service {{name: $name}}) "
            "RETURN [n IN nodes(path) | n.name] AS services, "
            "[r IN relationships(path) | type(r)] AS relationships, "
            "length(path) AS depth"
        )
    else:
        return json.dumps({"error": f"Invalid direction '{direction}', use 'downstream' or 'upstream'"})

    driver = _make_driver()
    try:
        async with driver.session() as session:
            result = await session.run(cypher, name=service_name)
            records = [_serialize_record(r) async for r in result]
            return json.dumps(records, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def get_blast_radius(service_name: str) -> str:
    """Find all services that would be affected if the given service goes down.

    Returns affected services with their SLO data and dependency chain.
    """
    cypher = (
        "MATCH path = (affected:Service)-[*1..10]->(target:Service {name: $name}) "
        "WITH DISTINCT affected, "
        "[r IN relationships(path) | type(r)] AS rel_chain, "
        "length(path) AS depth "
        "RETURN affected.name AS service, "
        "affected.type AS type, "
        "affected.slo_latency_ms AS slo_latency_ms, "
        "affected.slo_error_rate AS slo_error_rate, "
        "affected.owner AS owner, "
        "rel_chain AS dependency_chain, "
        "depth "
        "ORDER BY depth"
    )
    driver = _make_driver()
    try:
        async with driver.session() as session:
            result = await session.run(cypher, name=service_name)
            records = [_serialize_record(r) async for r in result]
            if not records:
                return json.dumps({"service": service_name, "affected": [], "message": "No upstream dependencies found"})
            return json.dumps({"service": service_name, "affected": records}, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def search_runbooks(
    query: str,
    service_name: str | None = None,
    top_k: int = 5,
) -> str:
    """Search runbooks using GraphRAG — vector similarity + graph traversal.

    Finds relevant runbook steps by semantic similarity, then enriches with
    graph context: parent runbook, applicable services, referenced services,
    and downstream dependencies.

    `service_name`: optional filter — boost results that apply to this service.
    `top_k`: number of results to return (default 5).
    """
    embedding = await _embed(query)
    cypher = """
    CALL db.index.vector.queryNodes('runbook_step_embedding', $k, $embedding)
    YIELD node AS step, score
    MATCH (rb:Runbook)-[:HAS_STEP]->(step)
    OPTIONAL MATCH (rb)-[:APPLIES_TO]->(svc:Service)
    OPTIONAL MATCH (step)-[:REFERENCES]->(ref:Service)
    RETURN step.content AS content,
           step.title AS step_title,
           rb.id AS runbook_id,
           rb.title AS runbook_title,
           rb.category AS category,
           rb.severity AS severity,
           collect(DISTINCT svc.name) AS applies_to_services,
           collect(DISTINCT ref.name) AS referenced_services,
           score
    ORDER BY score DESC
    """
    driver = _make_driver()
    try:
        async with driver.session() as session:
            result = await session.run(cypher, k=top_k, embedding=embedding)
            records = [_serialize_record(r) async for r in result]
            # Optionally boost results matching the target service
            if service_name and records:
                for r in records:
                    svcs = r.get("applies_to_services", []) + r.get("referenced_services", [])
                    if service_name in svcs:
                        r["service_match"] = True
                records.sort(key=lambda r: (not r.get("service_match", False), -r.get("score", 0)))
            return json.dumps(records, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def find_similar_incidents(
    query: str,
    service_name: str | None = None,
    severity: str | None = None,
    top_k: int = 5,
) -> str:
    """Find historically similar incidents using GraphRAG — vector similarity + graph traversal.

    Searches past incidents by semantic similarity, then enriches with graph context:
    affected services, root cause service, resolution runbooks, symptoms, and
    root cause service dependencies.

    `service_name`: optional filter — boost incidents involving this service.
    `severity`: optional filter — only return incidents of this severity (P1, P2, P3).
    `top_k`: number of results to return (default 5).
    """
    embedding = await _embed(query)
    cypher = """
    CALL db.index.vector.queryNodes('incident_embedding', $k, $embedding)
    YIELD node AS inc, score
    OPTIONAL MATCH (inc)-[:AFFECTED]->(affected:Service)
    OPTIONAL MATCH (inc)-[:ROOT_CAUSE_IN]->(root:Service)
    OPTIONAL MATCH (inc)-[:RESOLVED_BY]->(rb:Runbook)
    OPTIONAL MATCH (inc)-[:HAD_SYMPTOM]->(sym:Symptom)
    RETURN inc.id AS incident_id,
           inc.title AS title,
           inc.severity AS severity,
           inc.root_cause AS root_cause,
           inc.resolution AS resolution,
           inc.duration_minutes AS duration_minutes,
           collect(DISTINCT affected.name) AS affected_services,
           collect(DISTINCT root.name) AS root_cause_services,
           collect(DISTINCT rb.id) AS resolved_by_runbooks,
           collect(DISTINCT sym.name) AS symptoms,
           score
    ORDER BY score DESC
    """
    driver = _make_driver()
    try:
        async with driver.session() as session:
            result = await session.run(cypher, k=top_k, embedding=embedding)
            records = [_serialize_record(r) async for r in result]
            # Apply optional filters
            if severity:
                records = [r for r in records if r.get("severity") == severity]
            if service_name:
                for r in records:
                    all_svcs = r.get("affected_services", []) + r.get("root_cause_services", [])
                    if service_name in all_svcs:
                        r["service_match"] = True
                records.sort(key=lambda r: (not r.get("service_match", False), -r.get("score", 0)))
            return json.dumps(records, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def get_runbook_for_service(
    service_name: str,
    category: str | None = None,
) -> str:
    """Get runbooks that apply to a specific service — direct graph traversal (no vector search).

    Returns all runbooks linked to the service via APPLIES_TO, with their steps.

    `category`: optional filter (cache, latency, error, memory, cascade, capacity, degradation, monitoring).
    """
    cypher = """
    MATCH (rb:Runbook)-[:APPLIES_TO]->(svc:Service {name: $service_name})
    OPTIONAL MATCH (rb)-[:HAS_STEP]->(step:RunbookStep)
    WITH rb, step ORDER BY step.step_number
    RETURN rb.id AS runbook_id,
           rb.title AS title,
           rb.category AS category,
           rb.severity AS severity,
           rb.author AS author,
           collect({
               step_number: step.step_number,
               title: step.title,
               content: step.content
           }) AS steps
    ORDER BY rb.severity, rb.id
    """
    driver = _make_driver()
    try:
        async with driver.session() as session:
            result = await session.run(cypher, service_name=service_name)
            records = [_serialize_record(r) async for r in result]
            if category:
                records = [r for r in records if r.get("category") == category]
            if not records:
                return json.dumps({"service": service_name, "runbooks": [], "message": "No runbooks found"})
            return json.dumps({"service": service_name, "runbooks": records}, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


@mcp.tool()
async def search_knowledge_base(
    query: str,
    mode: str = "graphrag",
    top_k: int = 5,
) -> str:
    """Unified knowledge base search — compare GraphRAG vs naive RAG retrieval.

    `mode`:
      - 'graphrag': vector search + graph traversal (richer context, service relationships)
      - 'naive': vector search only (flat text results, no graph context)

    Use this tool to demonstrate the difference between GraphRAG and naive RAG retrieval.
    """
    if mode not in ("graphrag", "naive"):
        return json.dumps({"error": f"Invalid mode '{mode}', use 'graphrag' or 'naive'"})

    embedding = await _embed(query)

    if mode == "graphrag":
        runbook_cypher = """
        CALL db.index.vector.queryNodes('runbook_step_embedding', $k, $embedding)
        YIELD node AS step, score
        MATCH (rb:Runbook)-[:HAS_STEP]->(step)
        OPTIONAL MATCH (rb)-[:APPLIES_TO]->(svc:Service)
        OPTIONAL MATCH (step)-[:REFERENCES]->(ref:Service)
        RETURN step.content AS content, step.title AS step_title,
               rb.id AS runbook_id, rb.title AS runbook_title,
               collect(DISTINCT svc.name) AS services,
               collect(DISTINCT ref.name) AS references,
               score
        ORDER BY score DESC
        """
        incident_cypher = """
        CALL db.index.vector.queryNodes('incident_embedding', $k, $embedding)
        YIELD node AS inc, score
        OPTIONAL MATCH (inc)-[:AFFECTED]->(affected:Service)
        OPTIONAL MATCH (inc)-[:ROOT_CAUSE_IN]->(root:Service)
        OPTIONAL MATCH (inc)-[:RESOLVED_BY]->(rb:Runbook)
        OPTIONAL MATCH (inc)-[:HAD_SYMPTOM]->(sym:Symptom)
        RETURN inc.id AS id, inc.title AS title, inc.severity AS severity,
               inc.root_cause AS root_cause, inc.resolution AS resolution,
               collect(DISTINCT affected.name) AS affected_services,
               collect(DISTINCT root.name) AS root_cause_services,
               collect(DISTINCT rb.id) AS runbooks,
               collect(DISTINCT sym.name) AS symptoms,
               score
        ORDER BY score DESC
        """
    elif mode == "naive":
        runbook_cypher = """
        CALL db.index.vector.queryNodes('runbook_step_embedding', $k, $embedding)
        YIELD node AS step, score
        MATCH (rb:Runbook)-[:HAS_STEP]->(step)
        RETURN step.content AS content, step.title AS step_title,
               rb.id AS runbook_id, rb.title AS runbook_title,
               score
        ORDER BY score DESC
        """
        incident_cypher = """
        CALL db.index.vector.queryNodes('incident_embedding', $k, $embedding)
        YIELD node AS inc, score
        RETURN inc.id AS id, inc.title AS title,
               inc.description AS description,
               inc.root_cause AS root_cause, inc.resolution AS resolution,
               score
        ORDER BY score DESC
        """
    driver = _make_driver()
    try:
        async with driver.session() as session:
            rb_result = await session.run(runbook_cypher, k=top_k, embedding=embedding)
            runbooks = [_serialize_record(r) async for r in rb_result]

            inc_result = await session.run(incident_cypher, k=top_k, embedding=embedding)
            incidents = [_serialize_record(r) async for r in inc_result]

        return json.dumps({"mode": mode, "runbooks": runbooks, "incidents": incidents}, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


if __name__ == "__main__":
    mcp.run(transport="stdio")
