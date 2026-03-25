"""Neo4j graph topology and knowledge base routes."""

import os

from fastapi import APIRouter, Query
from neo4j import AsyncGraphDatabase

router = APIRouter()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")


async def _run_query(query: str, params: dict | None = None) -> list[dict]:
    driver = AsyncGraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        async with driver.session() as session:
            result = await session.run(query, params or {})
            return [dict(record) for record in await result.data()]
    finally:
        await driver.close()


@router.get("/topology")
async def get_topology():
    nodes_query = "MATCH (s:Service) RETURN s.name AS name, s.type AS type, labels(s) AS labels"
    edges_query = """
        MATCH (a:Service)-[r]->(b:Service)
        RETURN a.name AS source, type(r) AS relationship, b.name AS target
    """
    nodes = await _run_query(nodes_query)
    edges = await _run_query(edges_query)
    return {"nodes": nodes, "edges": edges}


@router.get("/blast-radius/{service}")
async def get_blast_radius(service: str):
    query = """
        MATCH (s:Service {name: $service})
        OPTIONAL MATCH (s)<-[:CALLS|ROUTES_TO|DEPENDS_ON*1..3]-(affected:Service)
        RETURN COLLECT(DISTINCT affected.name) AS affected_services
    """
    result = await _run_query(query, {"service": service})
    affected = result[0]["affected_services"] if result else []
    return {"service": service, "affected_services": affected}


@router.get("/runbooks/{service}")
async def get_runbooks(service: str):
    query = """
        MATCH (r:Runbook)-[:APPLIES_TO]->(s:Service {name: $service})
        OPTIONAL MATCH (r)-[:HAS_STEP]->(step:RunbookStep)
        RETURN r.id AS id, r.title AS title, r.severity AS severity,
               COLLECT(step.description) AS steps
        ORDER BY r.severity
    """
    return await _run_query(query, {"service": service})


@router.get("/incidents")
async def get_incidents(service: str = Query(None)):
    if service:
        query = """
            MATCH (i:Incident)-[:AFFECTED|ROOT_CAUSE_IN]->(s:Service {name: $service})
            RETURN i.id AS id, i.title AS title, i.severity AS severity,
                   i.resolution AS resolution, i.timestamp AS timestamp
            ORDER BY i.timestamp DESC
        """
        return await _run_query(query, {"service": service})
    else:
        query = """
            MATCH (i:Incident)
            RETURN i.id AS id, i.title AS title, i.severity AS severity,
                   i.resolution AS resolution, i.timestamp AS timestamp
            ORDER BY i.timestamp DESC LIMIT 20
        """
        return await _run_query(query)
