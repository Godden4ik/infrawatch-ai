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
import time
import httpx
from typing import List, Dict, Any
from dotenv import load_dotenv

load_dotenv()

from agents import run_pipeline

# ── Configuration ──────────────────────────────────────────────────

GOLD_DATASET_PATH = "scenarios/gold_truth.json"
SERVICE_URLS = {
    "api-gateway": "http://localhost:8080",
    "payment-service": "http://localhost:8001",
    "user-service": "http://localhost:8002",
    "order-service": "http://localhost:8003",
    "redis-cache": "http://localhost:8004",
}
WAIT_TIME = 12  # Seconds to wait for metrics to propagate


# ── Helpers ────────────────────────────────────────────────────────

def inject_anomaly(service: str, anomaly_type: str) -> bool:
    url = SERVICE_URLS.get(service)
    if not url:
        print(f"  [ERROR] Unknown service: {service}")
        return False
    try:
        resp = httpx.post(f"{url}/inject", params={"anomaly_type": anomaly_type}, timeout=5.0)
        return resp.status_code == 200
    except Exception as e:
        print(f"  [ERROR] Failed to inject anomaly: {e}")
        return False


def reset_all_services():
    for service, url in SERVICE_URLS.items():
        try:
            httpx.post(f"{url}/inject", params={"anomaly_type": "none"}, timeout=2.0)
        except:
            pass


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

async def run_benchmark():
    if not os.path.exists(GOLD_DATASET_PATH):
        print(f"Gold dataset not found at {GOLD_DATASET_PATH}")
        return

    with open(GOLD_DATASET_PATH, "r") as f:
        scenarios = json.load(f)

    print(f"\n🚀 Starting Accuracy Benchmark ({len(scenarios)} scenarios)")
    print("=" * 80)
    
    all_results = []
    
    for i, scenario in enumerate(scenarios):
        print(f"\n[{i+1}/{len(scenarios)}] Scenario: {scenario['name']}")
        print(f"  -> Injecting {scenario['anomaly']['type']} into {scenario['anomaly']['service']}...")
        
        # Reset and Inject
        reset_all_services()
        if not inject_anomaly(scenario['anomaly']['service'], scenario['anomaly']['type']):
            print("  [SKIP] Injection failed")
            continue
            
        print(f"  -> Waiting {WAIT_TIME}s for metrics...")
        await asyncio.sleep(WAIT_TIME)
        
        print(f"  -> Running Agent Pipeline...")
        start_time = time.time()
        try:
            # We run the pipeline. Note: this requires the full stack to be up.
            pipeline_result = await run_pipeline(verbose=False)
            duration = time.time() - start_time
            
            metrics = calculate_metrics(scenario, pipeline_result)
            metrics["duration"] = duration
            metrics["id"] = scenario["id"]
            metrics["name"] = scenario["name"]
            all_results.append(metrics)
            
            status = "✅ PASS" if metrics["rca_correct"] and metrics["blast_radius_recall"] >= 0.75 else "❌ FAIL"
            print(f"  -> Result: {status} | RCA: {metrics['rca_correct']} | BR Recall: {metrics['blast_radius_recall']:.2f} | Time: {duration:.1f}s")
            
        except Exception as e:
            print(f"  -> [ERROR] Pipeline failed: {e}")
        
        finally:
            reset_all_services()

    # ── Final Report ──────────────────────────────────────────────────
    
    print("\n" + "=" * 80)
    print("📊 FINAL ACCURACY REPORT")
    print("=" * 80)
    print(f"{'ID':<15} {'Scenario':<30} {'RCA':<6} {'BR Rec':<8} {'RB Rec':<8} {'Conf':<6}")
    print("-" * 80)
    
    total_rca = 0
    total_br_rec = 0.0
    total_rb_rec = 0.0
    
    for r in all_results:
        print(f"{r['id']:<15} {r['name'][:30]:<30} {'YES' if r['rca_correct'] else 'NO':<6} "
              f"{r['blast_radius_recall']:<8.2f} {r['runbook_recall']:<8.2f} {r['confidence']:<6.2f}")
        total_rca += 1 if r["rca_correct"] else 0
        total_br_rec += r["blast_radius_recall"]
        total_rb_rec += r["runbook_recall"]
        
    n = len(all_results)
    if n > 0:
        print("-" * 80)
        print(f"{'AVERAGE':<46} {total_rca/n:<6.2f} {total_br_rec/n:<8.2f} {total_rb_rec/n:<8.2f}")
        
    print("=" * 80)
    
    # Save results
    with open("scenarios/benchmark_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nResults saved to scenarios/benchmark_results.json")


if __name__ == "__main__":
    asyncio.run(run_benchmark())
