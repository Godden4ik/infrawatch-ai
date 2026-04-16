"""Evaluate GraphRAG vs Naive RAG retrieval quality.

Runs evaluation queries through both modes, uses LLM-as-judge (Claude) to score,
and outputs a comparison table.

Usage:
    python scripts/evaluate_rag.py           # Run all, print table
    python scripts/evaluate_rag.py --json    # Structured output
    python scripts/evaluate_rag.py --query 3 # Single query (1-indexed)
"""

import argparse
import asyncio
import json
import sys

from dotenv import load_dotenv

from graph.evaluation import build_mode_metrics, content_overlap, judge_result_sets
from graph.retrieval import graphrag_retrieve, naive_rag_retrieve

load_dotenv()

# ── Evaluation queries ───────────────────────────────────────────────

EVAL_QUERIES = [
    {
        "query": "Redis cache is down, all services are failing",
        "expected_services": ["redis-cache", "payment-service", "order-service", "user-service"],
        "category": "cascade",
    },
    {
        "query": "Payment service latency is very high, over 4 seconds",
        "expected_services": ["payment-service"],
        "category": "latency",
    },
    {
        "query": "API gateway returning 5xx errors on all routes",
        "expected_services": ["api-gateway"],
        "category": "error",
    },
    {
        "query": "Users cannot log in, session store seems broken",
        "expected_services": ["user-service", "redis-cache"],
        "category": "error",
    },
    {
        "query": "Order processing is stuck, payments timing out",
        "expected_services": ["order-service", "payment-service"],
        "category": "latency",
    },
    {
        "query": "Redis memory usage is at 92% and climbing",
        "expected_services": ["redis-cache"],
        "category": "memory",
    },
    {
        "query": "What is the blast radius if redis-cache goes down?",
        "expected_services": ["redis-cache", "payment-service", "user-service", "order-service"],
        "category": "cascade",
    },
    {
        "query": "Multiple services degraded after a deployment to user-service",
        "expected_services": ["user-service", "redis-cache"],
        "category": "cascade",
    },
    {
        "query": "How do we handle capacity planning for Redis?",
        "expected_services": ["redis-cache"],
        "category": "capacity",
    },
    {
        "query": "Payment gateway external dependency is not responding",
        "expected_services": ["payment-service"],
        "category": "latency",
    },
]


# ── Scoring ──────────────────────────────────────────────────────────

def score_results(query_info: dict, graphrag_results: dict, naive_results: dict) -> dict:
    """Score results without LLM — deterministic metrics."""
    expected_services = query_info["expected_services"]
    graphrag_metrics = build_mode_metrics(
        graphrag_results,
        expected_services=expected_services,
    )
    naive_metrics = build_mode_metrics(
        naive_results,
        expected_services=expected_services,
    )
    service_accuracy_delta = (
        graphrag_metrics["service_accuracy"] - naive_metrics["service_accuracy"]
    )
    context_richness_delta = (
        graphrag_metrics["context_richness"] - naive_metrics["context_richness"]
    )

    return {
        "query": query_info["query"],
        "category": query_info["category"],
        "content_overlap": round(content_overlap(graphrag_results, naive_results), 2),
        "graphrag": graphrag_metrics,
        "naive": naive_metrics,
        "graphrag_advantage": {
            "service_accuracy_delta": service_accuracy_delta,
            "context_richness_delta": context_richness_delta,
        },
    }


# ── Main ─────────────────────────────────────────────────────────────


async def evaluate_single(
    query_info: dict,
    judge_provider: str = "anthropic",
    judge_model: str | None = None,
    judge_api_key: str | None = None,
) -> dict:
    """Run a single query through both retrieval modes and score.

    judge_provider: provider id from PROVIDER_REGISTRY — controls which LLM grades the results.
    """
    service_ctx = query_info["expected_services"][0] if query_info["expected_services"] else None

    graphrag_results = await graphrag_retrieve(
        query_info["query"], service_context=service_ctx, top_k=5
    )
    naive_results = await naive_rag_retrieve(query_info["query"], top_k=5)

    scores = score_results(query_info, graphrag_results, naive_results)
    gr_judge, nr_judge, gr_fmt, nr_fmt = await judge_result_sets(
        query_info["query"],
        graphrag_results,
        naive_results,
        provider=judge_provider,
        model=judge_model,
        api_key=judge_api_key,
    )
    scores["graphrag_formatted"] = gr_fmt
    scores["naive_formatted"] = nr_fmt

    print(f"[evaluate_single] judge results: gr={gr_judge} nr={nr_judge}")
    scores["graphrag"]["llm_content_relevance"] = gr_judge["content_relevance"]
    scores["graphrag"]["llm_actionability"] = gr_judge["actionability"]
    scores["naive"]["llm_content_relevance"] = nr_judge["content_relevance"]
    scores["naive"]["llm_actionability"] = nr_judge["actionability"]

    return scores


async def evaluate_all(
    queries: list[dict] | None = None,
    judge_provider: str = "anthropic",
    judge_model: str | None = None,
    judge_api_key: str | None = None,
) -> list[dict]:
    """Run all evaluation queries."""
    queries = queries or EVAL_QUERIES
    results = []
    for i, q in enumerate(queries):
        print(f"  [{i+1}/{len(queries)}] {q['query'][:60]}...")
        result = await evaluate_single(
            q,
            judge_provider=judge_provider,
            judge_model=judge_model,
            judge_api_key=judge_api_key,
        )
        results.append(result)
    return results


def print_table(results: list[dict]) -> None:
    """Print a comparison table."""
    print("\n" + "=" * 100)
    print("GraphRAG vs Naive RAG Evaluation Results")
    print("=" * 100)
    print(f"{'#':<3} {'Query':<50} {'GR Svc':<8} {'N Svc':<8} {'GR Ctx':<8} {'N Ctx':<8}")
    print("-" * 100)

    gr_svc_total, n_svc_total = 0.0, 0.0
    gr_ctx_total, n_ctx_total = 0, 0

    for i, r in enumerate(results):
        gr = r["graphrag"]
        n = r["naive"]
        query = r["query"][:48]
        print(f"{i+1:<3} {query:<50} {gr['service_accuracy']:<8.2f} {n['service_accuracy']:<8.2f} "
              f"{gr['context_richness']:<8} {n['context_richness']:<8}")
        gr_svc_total += gr["service_accuracy"]
        n_svc_total += n["service_accuracy"]
        gr_ctx_total += gr["context_richness"]
        n_ctx_total += n["context_richness"]

    n = len(results)
    print("-" * 100)
    print(f"{'AVG':<3} {'':<50} {gr_svc_total/n:<8.2f} {n_svc_total/n:<8.2f} "
          f"{gr_ctx_total/n:<8.1f} {n_ctx_total/n:<8.1f}")
    print("=" * 100)
    print(f"\nGraphRAG avg service accuracy: {gr_svc_total/n:.2f}")
    print(f"Naive RAG avg service accuracy: {n_svc_total/n:.2f}")
    print(f"GraphRAG avg context richness:  {gr_ctx_total/n:.1f}")
    print(f"Naive RAG avg context richness: {n_ctx_total/n:.1f}")
    print(f"\nGraphRAG provides {gr_ctx_total/max(n_ctx_total,1):.1f}x richer context on average.")


def main():
    parser = argparse.ArgumentParser(description="Evaluate GraphRAG vs Naive RAG")
    parser.add_argument("--json", action="store_true", help="Output JSON results")
    parser.add_argument("--query", type=int, help="Run a single query (1-indexed)")
    parser.add_argument(
        "--provider",
        default="anthropic",
        help="LLM judge provider id from the provider registry (default: anthropic)",
    )
    parser.add_argument(
        "--model",
        default=None,
        help="Model name for the judge provider (default: provider's default model)",
    )
    args = parser.parse_args()

    if args.query:
        idx = args.query - 1
        if idx < 0 or idx >= len(EVAL_QUERIES):
            print(f"Query index must be 1-{len(EVAL_QUERIES)}")
            sys.exit(1)
        queries = [EVAL_QUERIES[idx]]
    else:
        queries = EVAL_QUERIES

    model_info = f", model: {args.model}" if args.model else ""
    print(f"Running evaluation... (judge: {args.provider}{model_info})")
    results = asyncio.run(
        evaluate_all(
            queries,
            judge_provider=args.provider,
            judge_model=args.model,
        )
    )

    if args.json:
        # Remove formatted text for cleaner JSON
        for r in results:
            r.pop("graphrag_formatted", None)
            r.pop("naive_formatted", None)
        print(json.dumps(results, indent=2))
        with open("evaluation_results.json", "w") as f:
            json.dump(results, f, indent=2)
        print("\nSaved to evaluation_results.json")
    else:
        print_table(results)


if __name__ == "__main__":
    main()
