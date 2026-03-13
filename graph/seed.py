"""Seed Neo4j with InfraWatch infrastructure topology.

Usage:
    python graph/seed.py

Requires NEO4J_URI, NEO4J_USER, NEO4J_PASSWORD env vars
(defaults: bolt://localhost:7687, neo4j, infrawatch).
"""

import os

from neo4j import GraphDatabase

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USER = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")

# ── Topology definition ──────────────────────────────────────────────

SERVICES = [
    {
        "name": "api-gateway",
        "type": "gateway",
        "port": 8000,
        "owner": "platform-team",
        "slo_latency_ms": 100,
        "slo_error_rate": 0.01,
        "description": "Entry point for all external API traffic",
    },
    {
        "name": "payment-service",
        "type": "backend",
        "port": 8001,
        "owner": "payments-team",
        "slo_latency_ms": 500,
        "slo_error_rate": 0.005,
        "description": "Processes financial transactions and billing",
    },
    {
        "name": "user-service",
        "type": "backend",
        "port": 8002,
        "owner": "identity-team",
        "slo_latency_ms": 50,
        "slo_error_rate": 0.01,
        "description": "Authentication, sessions, and user profiles",
    },
    {
        "name": "order-service",
        "type": "backend",
        "port": 8003,
        "owner": "commerce-team",
        "slo_latency_ms": 300,
        "slo_error_rate": 0.02,
        "description": "Order processing and fulfilment pipeline",
    },
    {
        "name": "redis-cache",
        "type": "datastore",
        "port": 8004,
        "owner": "platform-team",
        "slo_latency_ms": 5,
        "slo_error_rate": 0.001,
        "description": "In-memory cache and session store",
    },
]

# (source, target, relationship_type, properties)
DEPENDENCIES = [
    ("api-gateway", "payment-service", "ROUTES_TO", {"protocol": "HTTP", "path": "/api/payments"}),
    ("api-gateway", "user-service", "ROUTES_TO", {"protocol": "HTTP", "path": "/api/users"}),
    ("api-gateway", "order-service", "ROUTES_TO", {"protocol": "HTTP", "path": "/api/orders"}),
    ("payment-service", "redis-cache", "DEPENDS_ON", {"usage": "transaction-cache", "critical": True}),
    ("payment-service", "order-service", "CALLS", {"protocol": "HTTP", "purpose": "order-validation"}),
    ("user-service", "redis-cache", "DEPENDS_ON", {"usage": "session-store", "critical": True}),
    ("order-service", "payment-service", "CALLS", {"protocol": "HTTP", "purpose": "charge-customer"}),
    ("order-service", "user-service", "CALLS", {"protocol": "HTTP", "purpose": "verify-user"}),
    ("order-service", "redis-cache", "DEPENDS_ON", {"usage": "order-queue-cache", "critical": False}),
]

# Infrastructure nodes (hosts / environments)
INFRASTRUCTURE = [
    {"name": "docker-network", "type": "network", "cidr": "172.19.0.0/16"},
    {"name": "prod-cluster", "type": "environment", "region": "eu-central-1"},
]

# ── Seed logic ────────────────────────────────────────────────────────

CYPHER_CLEAR = "MATCH (n) DETACH DELETE n"

CYPHER_CREATE_SERVICE = """
MERGE (s:Service {name: $name})
SET s.type        = $type,
    s.port        = $port,
    s.owner       = $owner,
    s.slo_latency_ms  = $slo_latency_ms,
    s.slo_error_rate  = $slo_error_rate,
    s.description = $description
"""

CYPHER_CREATE_DEPENDENCY = """
MATCH (a:Service {name: $source})
MATCH (b:Service {name: $target})
CALL apoc.merge.relationship(a, $rel_type, {}, $props, b, {}) YIELD rel
RETURN rel
"""

CYPHER_CREATE_INFRA = """
MERGE (i:Infrastructure {name: $name})
SET i.type = $type
SET i += $props
"""

CYPHER_LINK_SERVICE_TO_INFRA = """
MATCH (s:Service)
MATCH (i:Infrastructure {name: 'docker-network'})
MERGE (s)-[:RUNS_ON]->(i)
WITH s
MATCH (e:Infrastructure {name: 'prod-cluster'})
MERGE (s)-[:DEPLOYED_IN]->(e)
"""

CYPHER_CREATE_INDEXES = [
    "CREATE INDEX IF NOT EXISTS FOR (s:Service) ON (s.name)",
    "CREATE INDEX IF NOT EXISTS FOR (i:Infrastructure) ON (i.name)",
]


def seed(tx):
    # Clear existing data
    tx.run(CYPHER_CLEAR)

    # Create service nodes
    for svc in SERVICES:
        tx.run(CYPHER_CREATE_SERVICE, **svc)

    # Create dependency edges
    for source, target, rel_type, props in DEPENDENCIES:
        tx.run(CYPHER_CREATE_DEPENDENCY, source=source, target=target, rel_type=rel_type, props=props)

    # Create infrastructure nodes
    for infra in INFRASTRUCTURE:
        extra = {k: v for k, v in infra.items() if k not in ("name", "type")}
        tx.run(CYPHER_CREATE_INFRA, name=infra["name"], type=infra["type"], props=extra)

    # Link services to infrastructure
    tx.run(CYPHER_LINK_SERVICE_TO_INFRA)


def main():
    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

    # Indexes must run outside write transactions (schema vs data)
    with driver.session() as session:
        for idx in CYPHER_CREATE_INDEXES:
            session.run(idx)

    with driver.session() as session:
        session.execute_write(seed)

    # Verify
    with driver.session() as session:
        svc_count = session.run("MATCH (s:Service) RETURN count(s) AS c").single()["c"]
        rel_count = session.run("MATCH ()-[r]->() RETURN count(r) AS c").single()["c"]
        print(f"Seeded {svc_count} services, {rel_count} relationships")

        print("\nDependency graph:")
        for rec in session.run("MATCH (a)-[r]->(b) RETURN a.name AS from, type(r) AS rel, b.name AS to ORDER BY a.name"):
            print(f"  {rec['from']} --[{rec['rel']}]--> {rec['to']}")

    driver.close()


if __name__ == "__main__":
    main()
