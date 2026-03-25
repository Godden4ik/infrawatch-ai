"""Unit tests for graph/ingest.py — YAML parsing, embedding calls, Cypher generation."""

from unittest.mock import MagicMock, patch

import pytest
import yaml

from graph.ingest import (
    load_incidents,
    load_runbooks,
    load_symptoms,
    ingest_incidents,
    ingest_runbooks,
    ingest_symptoms,
)


# ── YAML loading tests ──────────────────────────────────────────────


def test_load_runbooks_returns_list():
    runbooks = load_runbooks()
    assert isinstance(runbooks, list)
    assert len(runbooks) == 10


def test_load_runbooks_structure():
    runbooks = load_runbooks()
    rb = runbooks[0]
    assert "id" in rb
    assert "title" in rb
    assert "category" in rb
    assert "steps" in rb
    assert isinstance(rb["steps"], list)
    assert len(rb["steps"]) >= 3


def test_load_runbooks_steps_have_content():
    runbooks = load_runbooks()
    for rb in runbooks:
        for step in rb["steps"]:
            assert "step_number" in step
            assert "title" in step
            assert "content" in step
            assert len(step["content"]) > 20  # Non-trivial content


def test_load_incidents_returns_list():
    incidents = load_incidents()
    assert isinstance(incidents, list)
    assert len(incidents) == 10


def test_load_incidents_structure():
    incidents = load_incidents()
    inc = incidents[0]
    assert "id" in inc
    assert "title" in inc
    assert "severity" in inc
    assert "root_cause" in inc
    assert "resolution" in inc
    assert "affected_services" in inc
    assert "description" in inc


def test_load_incidents_have_services():
    incidents = load_incidents()
    for inc in incidents:
        assert len(inc["affected_services"]) > 0
        assert inc.get("root_cause_service") is not None


def test_load_symptoms_returns_list():
    symptoms = load_symptoms()
    assert isinstance(symptoms, list)
    assert len(symptoms) == 6


def test_load_symptoms_structure():
    symptoms = load_symptoms()
    sym = symptoms[0]
    assert "id" in sym
    assert "name" in sym
    assert "description" in sym
    assert "metric_pattern" in sym
    assert "manifests_in" in sym


# ── Ingestion logic tests (mocked Neo4j + embeddings) ───────────────


def _make_mock_tx():
    """Create a mock Neo4j transaction."""
    tx = MagicMock()
    tx.run = MagicMock()
    return tx


def _fake_embed(text: str) -> list[float]:
    """Return a deterministic fake embedding."""
    return [0.1] * 384


def test_ingest_symptoms():
    symptoms = load_symptoms()
    tx = _make_mock_tx()
    count = ingest_symptoms(tx, symptoms)
    assert count == 6
    # Should create symptom nodes + MANIFESTS_IN relationships
    assert tx.run.call_count > 6  # Nodes + relationships


def test_ingest_runbooks_with_fake_embeddings():
    runbooks = load_runbooks()[:2]  # Just first 2 for speed
    tx = _make_mock_tx()
    count = ingest_runbooks(tx, runbooks, embed_fn=_fake_embed)
    assert count == 2
    # Should create runbook nodes + steps + relationships
    assert tx.run.call_count > 4


def test_ingest_incidents_with_fake_embeddings():
    incidents = load_incidents()[:2]
    tx = _make_mock_tx()
    count = ingest_incidents(tx, incidents, embed_fn=_fake_embed)
    assert count == 2
    assert tx.run.call_count > 4


def test_ingest_runbooks_idempotent():
    """Running ingestion twice should not fail (MERGE queries)."""
    runbooks = load_runbooks()[:1]
    tx = _make_mock_tx()
    count1 = ingest_runbooks(tx, runbooks, embed_fn=_fake_embed)
    count2 = ingest_runbooks(tx, runbooks, embed_fn=_fake_embed)
    assert count1 == count2 == 1


def test_ingest_calls_embed_for_each_step():
    """Verify embedding function is called for each runbook step."""
    runbooks = load_runbooks()[:1]
    embed_calls = []

    def tracking_embed(text):
        embed_calls.append(text)
        return [0.1] * 384

    tx = _make_mock_tx()
    ingest_runbooks(tx, runbooks, embed_fn=tracking_embed)
    assert len(embed_calls) == len(runbooks[0]["steps"])


def test_ingest_calls_embed_for_each_incident():
    """Verify embedding function is called for each incident."""
    incidents = load_incidents()[:3]
    embed_calls = []

    def tracking_embed(text):
        embed_calls.append(text)
        return [0.1] * 384

    tx = _make_mock_tx()
    ingest_incidents(tx, incidents, embed_fn=tracking_embed)
    assert len(embed_calls) == 3
