"""Shared GraphRAG evaluation helpers for CLI and API."""

from __future__ import annotations

import asyncio
import json
import re
from typing import Any

from agents.providers import get_llm


def format_results(results: dict) -> str:
    """Format retrieval results into readable text for LLM judging."""
    parts: list[str] = []

    for rb in results.get("runbook_results", [])[:3]:
        parts.append(f"Runbook: {rb.get('runbook_title', 'N/A')} ({rb.get('runbook_id', '?')})")
        parts.append(f"  Step: {rb.get('step_title', 'N/A')}")
        content = str(rb.get("content", ""))
        parts.append(f"  Content: {content[:200]}...")
        if rb.get("applies_to_services"):
            parts.append(f"  Services: {rb['applies_to_services']}")
        if rb.get("referenced_services"):
            parts.append(f"  References: {rb['referenced_services']}")

    for inc in results.get("incident_results", [])[:3]:
        parts.append(f"Incident: {inc.get('title', 'N/A')} ({inc.get('incident_id', '?')})")
        root_cause = str(inc.get("root_cause", "N/A"))
        parts.append(f"  Root cause: {root_cause[:150]}")
        if inc.get("affected_services"):
            parts.append(f"  Affected: {inc['affected_services']}")
        if inc.get("symptoms"):
            parts.append(f"  Symptoms: {inc['symptoms']}")

    if results.get("service_context"):
        ctx = results["service_context"]
        parts.append(f"Service context: {ctx.get('service', '?')}")
        parts.append(f"  Runbooks: {ctx.get('runbooks', [])}")
        parts.append(f"  Past incidents: {ctx.get('incidents_affected', [])}")

    return "\n".join(parts)


def _extract_services(results: dict) -> set[str]:
    services: set[str] = set()

    for rb in results.get("runbook_results", []):
        services.update(_string_list(rb.get("applies_to_services")))
        services.update(_string_list(rb.get("referenced_services")))

    for inc in results.get("incident_results", []):
        services.update(_string_list(inc.get("affected_services")))
        services.update(_string_list(inc.get("root_cause_services")))

    return services


def _string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item]


def context_richness(results: dict) -> int:
    """Count populated graph-context fields."""
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


def result_count(results: dict) -> int:
    return len(results.get("runbook_results", [])) + len(results.get("incident_results", []))


def content_overlap(graphrag_results: dict, naive_results: dict) -> float:
    """Jaccard similarity of retrieved document ids."""
    gr_rb_ids = {
        rb.get("runbook_id")
        for rb in graphrag_results.get("runbook_results", [])
        if rb.get("runbook_id")
    }
    nr_rb_ids = {
        rb.get("runbook_id")
        for rb in naive_results.get("runbook_results", [])
        if rb.get("runbook_id")
    }
    gr_inc_ids = {
        inc.get("incident_id")
        for inc in graphrag_results.get("incident_results", [])
        if inc.get("incident_id")
    }
    nr_inc_ids = {
        inc.get("incident_id")
        for inc in naive_results.get("incident_results", [])
        if inc.get("incident_id")
    }

    all_gr_ids = gr_rb_ids | gr_inc_ids
    all_nr_ids = nr_rb_ids | nr_inc_ids
    union = all_gr_ids | all_nr_ids
    intersection = all_gr_ids & all_nr_ids
    return len(intersection) / len(union) if union else 1.0


def build_mode_metrics(results: dict, expected_services: list[str] | None = None) -> dict[str, Any]:
    services_found = sorted(_extract_services(results))
    metrics: dict[str, Any] = {
        "result_count": result_count(results),
        "context_richness": context_richness(results),
        "services_found": services_found,
    }

    if expected_services is not None:
        expected = set(expected_services)
        metrics["service_accuracy"] = (
            len(expected & set(services_found)) / len(expected) if expected else 1.0
        )

    return metrics


def build_judge_prompt(query: str, content: str) -> str:
    return (
        "You are evaluating retrieved content for an infrastructure incident response system.\n\n"
        f"Incident query: {query}\n\n"
        f"Retrieved content:\n{content[:2000]}\n\n"
        "Score this retrieved content on two dimensions (integers 1-10):\n"
        "- content_relevance: How well does content address specific incident described? "
        "(10 = directly relevant runbooks/incidents, 1 = unrelated)\n"
        "- actionability: How actionable are retrieved steps for on-call engineer resolving "
        "this right now? (10 = clear step-by-step remediation, 1 = no useful actions)\n\n"
        "Respond with only valid JSON, no explanation: "
        '{"content_relevance": <int>, "actionability": <int>}'
    )


def _parse_score(value: Any) -> int:
    try:
        parsed = int(value)
    except (TypeError, ValueError):
        return 5
    return max(1, min(parsed, 10))


def parse_judge_response(text: str) -> dict[str, int]:
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {"content_relevance": 5, "actionability": 5}

    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError:
        return {"content_relevance": 5, "actionability": 5}

    return {
        "content_relevance": _parse_score(parsed.get("content_relevance")),
        "actionability": _parse_score(parsed.get("actionability")),
    }


def _llm_response_to_text(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict) and isinstance(item.get("text"), str):
                parts.append(item["text"])
            elif hasattr(item, "text") and isinstance(item.text, str):
                parts.append(item.text)
            else:
                parts.append(str(item))
        return "\n".join(part for part in parts if part)
    return str(content)


async def llm_judge(
    query: str,
    content: str,
    provider: str = "anthropic",
    model: str | None = None,
    api_key: str | None = None,
) -> dict[str, int]:
    """Score retrieved content via provider registry LLM."""
    prompt = build_judge_prompt(query, content)

    try:
        llm = get_llm(provider=provider, model=model, api_key=api_key, temperature=0.0)
        response = await llm.ainvoke(prompt)
        text = _llm_response_to_text(getattr(response, "content", response))
        return parse_judge_response(text)
    except Exception as exc:
        print(f"[llm_judge] ERROR: {type(exc).__name__}: {exc}")
        return {"content_relevance": 5, "actionability": 5}


async def judge_result_sets(
    query: str,
    graphrag_results: dict,
    naive_results: dict,
    provider: str = "anthropic",
    model: str | None = None,
    api_key: str | None = None,
) -> tuple[dict[str, int], dict[str, int], str, str]:
    """Judge both result sets concurrently."""
    graphrag_formatted = format_results(graphrag_results)
    naive_formatted = format_results(naive_results)
    graphrag_judge, naive_judge = await asyncio.gather(
        llm_judge(query, graphrag_formatted, provider=provider, model=model, api_key=api_key),
        llm_judge(query, naive_formatted, provider=provider, model=model, api_key=api_key),
    )
    return graphrag_judge, naive_judge, graphrag_formatted, naive_formatted
