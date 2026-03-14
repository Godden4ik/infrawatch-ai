"""Integration tests for GraphRAG pipeline — requires docker compose up.

Tests ingestion into live Neo4j, vector index queries, and GraphRAG vs naive comparison.
"""

import os
import sys

import pytest
from neo4j import GraphDatabase

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "../.."))

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")


@pytest.fixture(scope="module")
def neo4j_driver():
    driver = GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    yield driver
    driver.close()


def test_knowledge_nodes_exist(neo4j_driver):
    """Verify runbooks, incidents, and symptoms were ingested."""
    with neo4j_driver.session() as session:
        for label, min_count in [("Runbook", 10), ("RunbookStep", 30), ("Incident", 10), ("Symptom", 6)]:
            count = session.run(f"MATCH (n:{label}) RETURN count(n) AS c").single()["c"]
            assert count >= min_count, f"Expected >= {min_count} {label} nodes, got {count}"


def test_knowledge_relationships_exist(neo4j_driver):
    """Verify knowledge graph relationships were created."""
    with neo4j_driver.session() as session:
        for rel_type in ["APPLIES_TO", "HAS_STEP", "REFERENCES", "AFFECTED",
                         "ROOT_CAUSE_IN", "RESOLVED_BY", "HAD_SYMPTOM", "MANIFESTS_IN"]:
            count = session.run(
                f"MATCH ()-[r:{rel_type}]->() RETURN count(r) AS c"
            ).single()["c"]
            assert count > 0, f"No {rel_type} relationships found"


def test_runbook_applies_to_service(neo4j_driver):
    """RB-001 should APPLY_TO redis-cache."""
    with neo4j_driver.session() as session:
        result = session.run(
            "MATCH (rb:Runbook {id: 'RB-001'})-[:APPLIES_TO]->(svc:Service) "
            "RETURN collect(svc.name) AS services"
        ).single()
        services = result["services"]
        assert "redis-cache" in services


def test_incident_root_cause_relationship(neo4j_driver):
    """INC-2024-001 should have ROOT_CAUSE_IN redis-cache."""
    with neo4j_driver.session() as session:
        result = session.run(
            "MATCH (inc:Incident {id: 'INC-2024-001'})-[:ROOT_CAUSE_IN]->(svc:Service) "
            "RETURN svc.name AS service"
        ).single()
        assert result["service"] == "redis-cache"


def test_vector_index_exists(neo4j_driver):
    """Vector indexes should exist for RunbookStep and Incident."""
    with neo4j_driver.session() as session:
        indexes = session.run("SHOW INDEXES").data()
        index_names = {idx["name"] for idx in indexes}
        assert "runbook_step_embedding" in index_names
        assert "incident_embedding" in index_names
