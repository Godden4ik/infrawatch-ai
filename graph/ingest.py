"""Ingest runbooks, incidents, and symptoms into Neo4j with vector embeddings.

Usage:
    python graph/ingest.py

Requires: NEO4J_URI/USER/PASSWORD env vars.
Run after: python graph/seed.py (topology must exist first).
"""

import os
from pathlib import Path

import yaml
from dotenv import load_dotenv
from neo4j import GraphDatabase
from sentence_transformers import SentenceTransformer

load_dotenv()

URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
USER = os.getenv("NEO4J_USER", "neo4j")
PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")

DATA_DIR = Path(__file__).resolve().parent / "data"

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
EMBEDDING_DIM = 384

# ── Embedding helper ─────────────────────────────────────────────────

_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer(EMBEDDING_MODEL)
    return _model


def embed_text(text: str) -> list[float]:
    """Generate a 384-dim embedding via all-MiniLM-L6-v2 (local)."""
    return _get_model().encode(text).tolist()


# ── YAML loading ─────────────────────────────────────────────────────


def load_runbooks() -> list[dict]:
    with open(DATA_DIR / "runbooks.yaml") as f:
        return yaml.safe_load(f)["runbooks"]


def load_incidents() -> list[dict]:
    with open(DATA_DIR / "incidents.yaml") as f:
        return yaml.safe_load(f)["incidents"]


def load_symptoms() -> list[dict]:
    with open(DATA_DIR / "symptoms.yaml") as f:
        return yaml.safe_load(f)["symptoms"]


# ── Cypher templates ─────────────────────────────────────────────────

CYPHER_CREATE_SYMPTOM = """
MERGE (sym:Symptom {id: $id})
SET sym.name = $name,
    sym.description = $description,
    sym.metric_pattern = $metric_pattern
"""

CYPHER_SYMPTOM_MANIFESTS = """
MATCH (sym:Symptom {id: $sym_id})
MATCH (svc:Service {name: $service_name})
MERGE (sym)-[:MANIFESTS_IN]->(svc)
"""

CYPHER_CREATE_RUNBOOK = """
MERGE (rb:Runbook {id: $id})
SET rb.title = $title,
    rb.category = $category,
    rb.severity = $severity,
    rb.author = $author
"""

CYPHER_RUNBOOK_APPLIES = """
MATCH (rb:Runbook {id: $rb_id})
MATCH (svc:Service {name: $service_name})
MERGE (rb)-[:APPLIES_TO]->(svc)
"""

CYPHER_CREATE_STEP = """
MATCH (rb:Runbook {id: $rb_id})
MERGE (rs:RunbookStep {id: $step_id})
SET rs.step_number = $step_number,
    rs.title = $title,
    rs.content = $content,
    rs.embedding = $embedding
MERGE (rb)-[:HAS_STEP]->(rs)
"""

CYPHER_STEP_REFERENCES = """
MATCH (rs:RunbookStep {id: $step_id})
MATCH (svc:Service {name: $service_name})
MERGE (rs)-[:REFERENCES]->(svc)
"""

CYPHER_CREATE_INCIDENT = """
MERGE (inc:Incident {id: $id})
SET inc.title = $title,
    inc.severity = $severity,
    inc.status = $status,
    inc.root_cause = $root_cause,
    inc.resolution = $resolution,
    inc.duration_minutes = $duration_minutes,
    inc.description = $description,
    inc.embedding = $embedding
"""

CYPHER_INCIDENT_AFFECTED = """
MATCH (inc:Incident {id: $inc_id})
MATCH (svc:Service {name: $service_name})
MERGE (inc)-[:AFFECTED]->(svc)
"""

CYPHER_INCIDENT_ROOT_CAUSE = """
MATCH (inc:Incident {id: $inc_id})
MATCH (svc:Service {name: $service_name})
MERGE (inc)-[:ROOT_CAUSE_IN]->(svc)
"""

CYPHER_INCIDENT_RESOLVED_BY = """
MATCH (inc:Incident {id: $inc_id})
MATCH (rb:Runbook {id: $rb_id})
MERGE (inc)-[:RESOLVED_BY]->(rb)
"""

CYPHER_INCIDENT_SYMPTOM = """
MATCH (inc:Incident {id: $inc_id})
MATCH (sym:Symptom {name: $symptom_name})
MERGE (inc)-[:HAD_SYMPTOM]->(sym)
"""

VECTOR_INDEXES = [
    """CREATE VECTOR INDEX runbook_step_embedding IF NOT EXISTS
       FOR (rs:RunbookStep) ON (rs.embedding)
       OPTIONS {indexConfig: {`vector.dimensions`: 384, `vector.similarity_function`: 'cosine'}}""",
    """CREATE VECTOR INDEX incident_embedding IF NOT EXISTS
       FOR (i:Incident) ON (i.embedding)
       OPTIONS {indexConfig: {`vector.dimensions`: 384, `vector.similarity_function`: 'cosine'}}""",
]

TEXT_INDEXES = [
    "CREATE INDEX IF NOT EXISTS FOR (rb:Runbook) ON (rb.id)",
    "CREATE INDEX IF NOT EXISTS FOR (rs:RunbookStep) ON (rs.id)",
    "CREATE INDEX IF NOT EXISTS FOR (inc:Incident) ON (inc.id)",
    "CREATE INDEX IF NOT EXISTS FOR (sym:Symptom) ON (sym.id)",
    "CREATE INDEX IF NOT EXISTS FOR (sym:Symptom) ON (sym.name)",
]


# ── Ingestion logic ──────────────────────────────────────────────────


def ingest_symptoms(tx, symptoms: list[dict]) -> int:
    """Create Symptom nodes and MANIFESTS_IN relationships."""
    count = 0
    for sym in symptoms:
        tx.run(CYPHER_CREATE_SYMPTOM,
               id=sym["id"], name=sym["name"],
               description=sym["description"],
               metric_pattern=sym["metric_pattern"])
        for svc in sym.get("manifests_in", []):
            tx.run(CYPHER_SYMPTOM_MANIFESTS, sym_id=sym["id"], service_name=svc)
        count += 1
    return count


def ingest_runbooks(tx, runbooks: list[dict], embed_fn=embed_text) -> int:
    """Create Runbook/RunbookStep nodes with embeddings and relationships."""
    count = 0
    for rb in runbooks:
        tx.run(CYPHER_CREATE_RUNBOOK,
               id=rb["id"], title=rb["title"],
               category=rb["category"], severity=rb["severity"],
               author=rb["author"])
        for svc in rb.get("applies_to", []):
            tx.run(CYPHER_RUNBOOK_APPLIES, rb_id=rb["id"], service_name=svc)
        for step in rb.get("steps", []):
            step_id = f"{rb['id']}-S{step['step_number']}"
            embedding = embed_fn(f"{step['title']}: {step['content']}")
            tx.run(CYPHER_CREATE_STEP,
                   rb_id=rb["id"], step_id=step_id,
                   step_number=step["step_number"],
                   title=step["title"], content=step["content"],
                   embedding=embedding)
            for svc in step.get("references", []):
                tx.run(CYPHER_STEP_REFERENCES, step_id=step_id, service_name=svc)
        count += 1
    return count


def ingest_incidents(tx, incidents: list[dict], embed_fn=embed_text) -> int:
    """Create Incident nodes with embeddings and all relationships."""
    count = 0
    for inc in incidents:
        embed_input = f"{inc['title']}: {inc['description']}"
        embedding = embed_fn(embed_input)
        tx.run(CYPHER_CREATE_INCIDENT,
               id=inc["id"], title=inc["title"],
               severity=inc["severity"], status=inc["status"],
               root_cause=inc["root_cause"], resolution=inc["resolution"],
               duration_minutes=inc["duration_minutes"],
               description=inc["description"], embedding=embedding)
        for svc in inc.get("affected_services", []):
            tx.run(CYPHER_INCIDENT_AFFECTED, inc_id=inc["id"], service_name=svc)
        if inc.get("root_cause_service"):
            tx.run(CYPHER_INCIDENT_ROOT_CAUSE,
                   inc_id=inc["id"], service_name=inc["root_cause_service"])
        if inc.get("resolved_by"):
            tx.run(CYPHER_INCIDENT_RESOLVED_BY,
                   inc_id=inc["id"], rb_id=inc["resolved_by"])
        for sym_name in inc.get("symptoms", []):
            tx.run(CYPHER_INCIDENT_SYMPTOM,
                   inc_id=inc["id"], symptom_name=sym_name)
        count += 1
    return count


def create_indexes(session) -> None:
    """Create text and vector indexes (must run outside write transactions)."""
    for idx in TEXT_INDEXES:
        session.run(idx)
    for idx in VECTOR_INDEXES:
        session.run(idx)


def main():
    print("Loading data files...")
    symptoms = load_symptoms()
    runbooks = load_runbooks()
    incidents = load_incidents()
    print(f"  {len(symptoms)} symptoms, {len(runbooks)} runbooks, {len(incidents)} incidents")

    driver = GraphDatabase.driver(URI, auth=(USER, PASSWORD))

    # Create indexes first (schema operations)
    print("Creating indexes...")
    with driver.session() as session:
        create_indexes(session)

    # Ingest data
    print("Ingesting symptoms...")
    with driver.session() as session:
        sym_count = session.execute_write(ingest_symptoms, symptoms)
    print(f"  → {sym_count} symptoms ingested")

    print("Ingesting runbooks (with embeddings)...")
    with driver.session() as session:
        rb_count = session.execute_write(ingest_runbooks, runbooks)
    print(f"  → {rb_count} runbooks ingested")

    print("Ingesting incidents (with embeddings)...")
    with driver.session() as session:
        inc_count = session.execute_write(ingest_incidents, incidents)
    print(f"  → {inc_count} incidents ingested")

    # Verify
    with driver.session() as session:
        for label in ["Symptom", "Runbook", "RunbookStep", "Incident"]:
            count = session.run(f"MATCH (n:{label}) RETURN count(n) AS c").single()["c"]
            print(f"  {label}: {count} nodes")
        rel_count = session.run(
            "MATCH ()-[r]->() WHERE type(r) IN "
            "['APPLIES_TO','HAS_STEP','REFERENCES','AFFECTED','ROOT_CAUSE_IN','RESOLVED_BY','HAD_SYMPTOM','MANIFESTS_IN'] "
            "RETURN count(r) AS c"
        ).single()["c"]
        print(f"  Knowledge relationships: {rel_count}")

    driver.close()
    print("\nIngestion complete!")


if __name__ == "__main__":
    main()
