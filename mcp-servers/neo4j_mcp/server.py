"""Neo4j MCP Server — exposes Cypher queries and topology traversal tools for agents."""

import json
import os

from neo4j import AsyncGraphDatabase
from mcp.server.fastmcp import FastMCP

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")

mcp = FastMCP(
    name="neo4j-mcp",
    instructions=(
        "Neo4j graph database server for InfraWatch infrastructure topology. "
        "Schema: Service nodes (name, type, port, owner, slo_latency_ms, slo_error_rate, description), "
        "Infrastructure nodes (name, type). "
        "Relationships: ROUTES_TO, DEPENDS_ON, CALLS, RUNS_ON, DEPLOYED_IN. "
        "Services: api-gateway, payment-service, user-service, order-service, redis-cache."
    ),
)

_driver = None


def _get_driver():
    global _driver
    if _driver is None:
        _driver = AsyncGraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    return _driver


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
async def run_cypher(query: str, params: str | None = None) -> str:
    """Execute a Cypher query against the Neo4j infrastructure topology graph.

    `params` is an optional JSON string of query parameters, e.g. '{"name": "redis-cache"}'.
    """
    driver = _get_driver()
    parsed_params = {}
    if params:
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

    driver = _get_driver()
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
    driver = _get_driver()
    try:
        async with driver.session() as session:
            result = await session.run(cypher, name=service_name)
            records = [_serialize_record(r) async for r in result]
            if not records:
                return json.dumps({"service": service_name, "affected": [], "message": "No upstream dependencies found"})
            return json.dumps({"service": service_name, "affected": records}, indent=2)
    except Exception as e:
        return json.dumps({"error": str(e)})


if __name__ == "__main__":
    mcp.run(transport="stdio")
