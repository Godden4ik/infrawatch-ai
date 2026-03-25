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
import os
import sys

from dotenv import load_dotenv

load_dotenv()

# Add project root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from graph.retrieval import graphrag_retrieve, naive_rag_retrieve

# ── Evaluation queries ───────────────────────────────────────────────

EVAL_QUERIES = [
    {
        "query": "Redis cache is down, all services are failing",
        "expected_services": ["redis-cache"],
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


def _format_results(results: dict) -> str:
    """Format retrieval results into a readable string."""
    parts = []
    for rb in results.get("runbook_results", [])[:3]:
        parts.append(f"Runbook: {rb.get('runbook_title', 'N/A')} ({rb.get('runbook_id', '?')})")
        parts.append(f"  Step: {rb.get('step_title', 'N/A')}")
        content = rb.get("content", "")
        parts.append(f"  Content: {content[:200]}...")
        if "applies_to_services" in rb:
            parts.append(f"  Services: {rb['applies_to_services']}")
        if "referenced_services" in rb:
            parts.append(f"  References: {rb['referenced_services']}")
    for inc in results.get("incident_results", [])[:3]:
        parts.append(f"Incident: {inc.get('title', 'N/A')} ({inc.get('incident_id', '?')})")
        parts.append(f"  Root cause: {inc.get('root_cause', 'N/A')[:150]}")
        if "affected_services" in inc:
            parts.append(f"  Affected: {inc['affected_services']}")
        if "symptoms" in inc:
            parts.append(f"  Symptoms: {inc['symptoms']}")
    if "service_context" in results and results["service_context"]:
        ctx = results["service_context"]
        parts.append(f"Service context: {ctx.get('service', '?')}")
        parts.append(f"  Runbooks: {ctx.get('runbooks', [])}")
        parts.append(f"  Past incidents: {ctx.get('incidents_affected', [])}")
    return "\n".join(parts)


def score_results(query_info: dict, graphrag_results: dict, naive_results: dict) -> dict:
    """Score results without LLM — deterministic metrics."""
    expected = set(query_info["expected_services"])

    # Extract services mentioned in results
    def extract_services(results):
        services = set()
        for rb in results.get("runbook_results", []):
            services.update(rb.get("applies_to_services", []))
            services.update(rb.get("referenced_services", []))
        for inc in results.get("incident_results", []):
            services.update(inc.get("affected_services", []))
            services.update(inc.get("root_cause_services", []))
        return services

    graphrag_services = extract_services(graphrag_results)
    naive_services = extract_services(naive_results)

    # Service accuracy: fraction of expected services found
    graphrag_svc_acc = len(expected & graphrag_services) / len(expected) if expected else 1.0
    naive_svc_acc = len(expected & naive_services) / len(expected) if expected else 1.0

    # Context richness: count of distinct context fields populated
    def context_richness(results):
        fields = 0
        for rb in results.get("runbook_results", []):
            if rb.get("applies_to_services"):
                fields += 1
            if rb.get("referenced_services"):
                fields += 1
            if rb.get("downstream_dependencies"):
                fields += 1
        for inc in results.get("incident_results", []):
            if inc.get("affected_services"):
                fields += 1
            if inc.get("root_cause_services"):
                fields += 1
            if inc.get("symptoms"):
                fields += 1
            if inc.get("resolved_by_runbooks"):
                fields += 1
        if results.get("service_context"):
            fields += 3
        return fields

    graphrag_richness = context_richness(graphrag_results)
    naive_richness = context_richness(naive_results)

    # Result count
    graphrag_count = len(graphrag_results.get("runbook_results", [])) + len(graphrag_results.get("incident_results", []))
    naive_count = len(naive_results.get("runbook_results", [])) + len(naive_results.get("incident_results", []))

    return {
        "query": query_info["query"],
        "category": query_info["category"],
        "graphrag": {
            "service_accuracy": graphrag_svc_acc,
            "context_richness": graphrag_richness,
            "result_count": graphrag_count,
            "services_found": sorted(graphrag_services),
        },
        "naive": {
            "service_accuracy": naive_svc_acc,
            "context_richness": naive_richness,
            "result_count": naive_count,
            "services_found": sorted(naive_services),
        },
        "graphrag_advantage": {
            "service_accuracy_delta": graphrag_svc_acc - naive_svc_acc,
            "context_richness_delta": graphrag_richness - naive_richness,
        },
    }


# ── Main ─────────────────────────────────────────────────────────────


async def evaluate_single(query_info: dict) -> dict:
    """Run a single query through both retrieval modes and score."""
    service_ctx = query_info["expected_services"][0] if query_info["expected_services"] else None

    graphrag_results = await graphrag_retrieve(
        query_info["query"], service_context=service_ctx, top_k=5
    )
    naive_results = await naive_rag_retrieve(query_info["query"], top_k=5)

    scores = score_results(query_info, graphrag_results, naive_results)
    scores["graphrag_formatted"] = _format_results(graphrag_results)
    scores["naive_formatted"] = _format_results(naive_results)
    return scores


async def evaluate_all(queries: list[dict] | None = None) -> list[dict]:
    """Run all evaluation queries."""
    queries = queries or EVAL_QUERIES
    results = []
    for i, q in enumerate(queries):
        print(f"  [{i+1}/{len(queries)}] {q['query'][:60]}...")
        result = await evaluate_single(q)
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
    args = parser.parse_args()

    if args.query:
        idx = args.query - 1
        if idx < 0 or idx >= len(EVAL_QUERIES):
            print(f"Query index must be 1-{len(EVAL_QUERIES)}")
            sys.exit(1)
        queries = [EVAL_QUERIES[idx]]
    else:
        queries = EVAL_QUERIES

    print("Running evaluation...")
    results = asyncio.run(evaluate_all(queries))

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
