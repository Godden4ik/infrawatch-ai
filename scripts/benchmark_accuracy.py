"""Benchmark agent pipeline accuracy against a Gold Dataset of scenarios.

This script injects anomalies, runs the pipeline, and calculates:
- RCA Precision: Was the root cause service correctly identified?
- Blast Radius Recall: Did it find all affected services?
- Runbook Precision: Were the expected runbooks retrieved?

Usage:
    python scripts/benchmark_accuracy.py
"""

import asyncio
import json
import os
import sys
import time
import httpx
import logging
from typing import List, Dict, Any, Callable, Awaitable
from dotenv import load_dotenv

load_dotenv()

from agents import run_pipeline

# ── Configuration ──────────────────────────────────────────────────

GOLD_DATASET_PATH = os.getenv("GOLD_DATASET_PATH", "scenarios/gold_truth.json")

# Service URLs from environment (for Docker) or fallback to localhost
SERVICE_URLS = {
    "api-gateway": os.getenv("API_GATEWAY_URL", "http://localhost:8080"),
    "payment-service": os.getenv("PAYMENT_SERVICE_URL", "http://localhost:8001"),
    "user-service": os.getenv("USER_SERVICE_URL", "http://localhost:8002"),
    "order-service": os.getenv("ORDER_SERVICE_URL", "http://localhost:8003"),
    "redis-cache": os.getenv("REDIS_CACHE_URL", "http://localhost:8004"),
}
WAIT_TIME = int(os.getenv("BENCHMARK_WAIT_TIME", "12"))

# Allow-list of (service, anomaly_type) pairs that services actually implement.
# Mirrors the dispatch branches in each services/*/app.py _simulate() loop.
SUPPORTED_ANOMALIES: dict[str, set[str]] = {
    "api-gateway": {"latency", "error"},
    "payment-service": {"latency", "cache_degraded", "error"},
    "user-service": {"latency", "error", "memory_leak"},
    "order-service": {"latency", "cache_degraded", "error"},
    "redis-cache": {"cache_failure", "error", "memory_leak"},
}


def validate_scenarios(scenarios: List[Dict[str, Any]]) -> List[str]:
    errors: List[str] = []
    for s in scenarios:
        svc = s.get("anomaly", {}).get("service")
        atype = s.get("anomaly", {}).get("type")
        allowed = SUPPORTED_ANOMALIES.get(svc)
        if allowed is None:
            errors.append(f"{s.get('id', '?')}: unknown service '{svc}'")
            continue
        if atype not in allowed:
            errors.append(f"{s.get('id', '?')}: ({svc}, {atype}) not in {sorted(allowed)}")
    return errors


# ── Helpers ────────────────────────────────────────────────────────

async def inject_anomaly(service: str, anomaly_type: str, log: Callable[[str], Awaitable[None]]) -> bool:
    url = SERVICE_URLS.get(service)
    if not url:
        await log(f"  [ERROR] Unknown service: {service}")
        return False
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(f"{url}/inject", params={"anomaly_type": anomaly_type}, timeout=5.0)
            return resp.status_code == 200
    except Exception as e:
        await log(f"  [ERROR] Failed to inject anomaly: {e}")
        return False


async def reset_all_services(log: Callable[[str], Awaitable[None]]):
    async with httpx.AsyncClient() as client:
        tasks = []
        for service, url in SERVICE_URLS.items():
            tasks.append(client.post(f"{url}/inject", params={"anomaly_type": "none"}, timeout=2.0))
        await asyncio.gather(*tasks, return_exceptions=True)


def calculate_metrics(scenario: Dict, result: Dict) -> Dict:
    expected = scenario["expected"]
    
    # RCA Accuracy (Boolean)
    predicted_rca = result.get("root_cause", "").lower()
    rca_correct = expected["root_cause"].lower() in predicted_rca
    
    # Blast Radius Recall
    expected_br = set(expected["affected_services"])
    predicted_br = {x["service"] for x in result.get("blast_radius", [])}
    
    intersection_br = predicted_br.intersection(expected_br)
    br_recall = len(intersection_br) / len(expected_br) if expected_br else 1.0
    br_precision = len(intersection_br) / len(predicted_br) if predicted_br else 0.0
    
    # Runbook Recall
    expected_rb = set(expected["relevant_runbooks"])
    predicted_rb = {rb["id"] for rb in result.get("relevant_runbooks", [])}
    
    intersection_rb = predicted_rb.intersection(expected_rb)
    rb_recall = len(intersection_rb) / len(expected_rb) if expected_rb else 1.0

    return {
        "rca_correct": rca_correct,
        "blast_radius_recall": br_recall,
        "blast_radius_precision": br_precision,
        "runbook_recall": rb_recall,
        "confidence": result.get("confidence", 0.0)
    }


# ── Main ───────────────────────────────────────────────────────────

async def run_benchmark(
    llm_provider: str = "anthropic",
    llm_model: str | None = None,
    api_key: str | None = None,
    log_callback: Callable[[str], Awaitable[None]] | None = None
):
    async def log(msg: str):
        print(msg)
        if log_callback:
            await log_callback(msg)

    if not os.path.exists(GOLD_DATASET_PATH):
        await log(f"Gold dataset not found at {GOLD_DATASET_PATH}")
        return []

    with open(GOLD_DATASET_PATH, "r") as f:
        scenarios = json.load(f)

    validation_errors = validate_scenarios(scenarios)
    if validation_errors:
        await log("❌ Gold dataset validation failed:")
        for e in validation_errors:
            await log(f"  - {e}")
        await log("Refusing to run benchmark with unrecognized (service, anomaly_type) pairs.")
        sys.exit(1)

    await log(f"\n🚀 Starting Accuracy Benchmark ({len(scenarios)} scenarios)")
    await log(f"Model: {llm_provider} / {llm_model or 'default'}")
    await log("=" * 80)
    
    all_results = []
    
    for i, scenario in enumerate(scenarios):
        await log(f"\n[{i+1}/{len(scenarios)}] Scenario: {scenario['name']}")
        await log(f"  -> Injecting {scenario['anomaly']['type']} into {scenario['anomaly']['service']}...")
        
        # Reset and Inject
        await reset_all_services(log)
        if not await inject_anomaly(scenario['anomaly']['service'], scenario['anomaly']['type'], log):
            await log("  [SKIP] Injection failed")
            continue
            
        await log(f"  -> Waiting {WAIT_TIME}s for metrics...")
        await asyncio.sleep(WAIT_TIME)
        
        await log(f"  -> Running Agent Pipeline...")
        start_time = time.time()
        try:
            pipeline_result = await run_pipeline(
                verbose=False,
                llm_provider=llm_provider,
                llm_model=llm_model,
                api_key=api_key
            )
            duration = time.time() - start_time
            
            metrics = calculate_metrics(scenario, pipeline_result)
            metrics["duration"] = duration
            metrics["id"] = scenario["id"]
            metrics["name"] = scenario["name"]
            all_results.append(metrics)
            
            status = "✅ PASS" if metrics["rca_correct"] and metrics["blast_radius_recall"] >= 0.75 else "❌ FAIL"
            await log(f"  -> Result: {status} | RCA: {metrics['rca_correct']} | BR Recall: {metrics['blast_radius_recall']:.2f} | Time: {duration:.1f}s")
            
        except Exception as e:
            await log(f"  -> [ERROR] Pipeline failed: {e}")
            import traceback
            await log(traceback.format_exc())
        
        finally:
            await reset_all_services(log)

    # ── Final Report ──────────────────────────────────────────────────
    
    await log("\n" + "=" * 80)
    await log("📊 FINAL ACCURACY REPORT")
    await log("=" * 80)
    await log(f"{'ID':<15} {'Scenario':<30} {'RCA':<6} {'BR Rec':<8} {'RB Rec':<8} {'Conf':<6}")
    await log("-" * 80)
    
    total_rca = 0
    total_br_rec = 0.0
    total_rb_rec = 0.0
    
    for r in all_results:
        await log(f"{r['id']:<15} {r['name'][:30]:<30} {'YES' if r['rca_correct'] else 'NO':<6} "
              f"{r['blast_radius_recall']:<8.2f} {r['runbook_recall']:<8.2f} {r['confidence']:<6.2f}")
        total_rca += 1 if r["rca_correct"] else 0
        total_br_rec += r["blast_radius_recall"]
        total_rb_rec += r["runbook_recall"]
        
    n = len(all_results)
    if n > 0:
        await log("-" * 80)
        await log(f"{'AVERAGE':<46} {total_rca/n:<6.2f} {total_br_rec/n:<8.2f} {total_rb_rec/n:<8.2f}")
        
    await log("=" * 80)
    
    # Save results
    results_path = os.getenv("BENCHMARK_RESULTS_PATH", "scenarios/benchmark_results.json")
    try:
        os.makedirs(os.path.dirname(results_path), exist_ok=True)
        with open(results_path, "w") as f:
            json.dump(all_results, f, indent=2)
        await log(f"\nResults saved to {results_path}")
    except Exception as e:
        await log(f"\nFailed to save results: {e}")

    return all_results


if __name__ == "__main__":
    asyncio.run(run_benchmark())

