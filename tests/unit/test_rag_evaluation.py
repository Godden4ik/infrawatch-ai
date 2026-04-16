"""Unit tests for shared RAG evaluation helpers and API route."""

from api_backend.routes import rag as rag_route
from api_backend.routes.rag import EvalRequest
from graph.evaluation import build_mode_metrics, parse_judge_response


def test_build_mode_metrics_counts_graph_context():
    results = {
        "runbook_results": [
            {
                "runbook_id": "RB-001",
                "applies_to_services": ["redis-cache"],
                "referenced_services": ["payment-service"],
                "downstream_dependencies": ["order-service"],
            }
        ],
        "incident_results": [
            {
                "incident_id": "INC-001",
                "affected_services": ["redis-cache", "payment-service"],
                "root_cause_services": ["redis-cache"],
                "resolved_by_runbooks": ["RB-001"],
                "symptoms": ["latency"],
            }
        ],
        "service_context": {"service": "redis-cache"},
    }

    metrics = build_mode_metrics(results, expected_services=["redis-cache", "payment-service"])

    assert metrics["result_count"] == 2
    assert metrics["context_richness"] == 10
    assert metrics["services_found"] == ["payment-service", "redis-cache"]
    assert metrics["service_accuracy"] == 1.0


def test_parse_judge_response_clamps_scores():
    parsed = parse_judge_response('prefix {"content_relevance": 42, "actionability": 0} suffix')
    assert parsed == {"content_relevance": 10, "actionability": 1}


async def test_evaluate_rag_returns_judge_metrics(monkeypatch):
    graphrag_results = {
        "runbook_results": [
            {
                "runbook_id": "RB-001",
                "runbook_title": "Redis recovery",
                "content": "Restart redis",
                "applies_to_services": ["redis-cache"],
                "referenced_services": ["payment-service"],
                "downstream_dependencies": ["order-service"],
            }
        ],
        "incident_results": [
            {
                "incident_id": "INC-001",
                "title": "Redis outage",
                "affected_services": ["redis-cache"],
                "root_cause_services": ["redis-cache"],
                "resolved_by_runbooks": ["RB-001"],
                "symptoms": ["downtime"],
            }
        ],
        "service_context": {"service": "redis-cache"},
    }
    naive_results = {
        "runbook_results": [
            {
                "runbook_id": "RB-001",
                "runbook_title": "Redis recovery",
                "content": "Restart redis",
            }
        ],
        "incident_results": [
            {
                "incident_id": "INC-001",
                "title": "Redis outage",
            }
        ],
    }

    async def fake_graphrag_retrieve(*_args, **_kwargs):
        return graphrag_results

    async def fake_naive_rag_retrieve(*_args, **_kwargs):
        return naive_results

    async def fake_judge_result_sets(*_args, **_kwargs):
        return (
            {"content_relevance": 9, "actionability": 8},
            {"content_relevance": 7, "actionability": 6},
            "graph formatted",
            "naive formatted",
        )

    monkeypatch.setattr(rag_route, "graphrag_retrieve", fake_graphrag_retrieve)
    monkeypatch.setattr(rag_route, "naive_rag_retrieve", fake_naive_rag_retrieve)
    monkeypatch.setattr(rag_route, "judge_result_sets", fake_judge_result_sets)

    result = await rag_route.evaluate_rag(
        EvalRequest(
            query="redis down",
            service_context="redis-cache",
            judge_provider="ollama",
            judge_model="qwen2.5:14b",
        )
    )

    assert result["judge_provider"] == "ollama"
    assert result["judge_model"] == "qwen2.5:14b"
    assert result["content_overlap"] == 1.0
    assert result["graphrag"]["metrics"]["llm_content_relevance"] == 9
    assert result["graphrag"]["metrics"]["llm_actionability"] == 8
    assert (
        result["graphrag"]["metrics"]["context_richness"]
        > result["naive"]["metrics"]["context_richness"]
    )
    assert result["naive"]["metrics"]["llm_content_relevance"] == 7
