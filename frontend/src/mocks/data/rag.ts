import type { RagResult } from "@/services/rag/schema";

export function getMockRagResult(query: string): RagResult {
  return {
    query,
    judge_provider: "anthropic",
    judge_model: "claude-haiku-4-5-20251001",
    content_overlap: 0.75,
    graphrag: {
      runbook_results: [
        {
          runbook_id: "RB-001",
          runbook_title: "Redis Cache Failure Recovery",
          severity: "critical",
          step_title: "Recover Redis primary",
          content:
            "Check redis-cache pod health. Verify memory usage. Flush stale keys if memory > 90%. Restart service if unresponsive.",
          applies_to_services: ["redis-cache"],
          downstream_dependencies: ["payment-service", "order-service"],
        },
        {
          runbook_id: "RB-002",
          runbook_title: "Payment Service Latency Spike",
          severity: "high",
          step_title: "Reduce latency",
          content:
            "Check P95 latency in Grafana. Verify redis-cache connectivity. Scale horizontally if load-related.",
          applies_to_services: ["payment-service"],
          referenced_services: ["redis-cache"],
        },
      ],
      incident_results: [
        {
          id: "inc-7",
          title: "Redis memory pressure cascade",
          severity: "critical",
          resolution: "Flushed stale keys, restarted pod",
          affected_services: ["redis-cache", "payment-service", "order-service"],
          root_cause_service: "redis-cache",
        },
        {
          id: "inc-12",
          title: "Payment timeout during peak traffic",
          severity: "high",
          resolution: "Auto-scaled to 3 replicas",
          affected_services: ["payment-service", "api-gateway"],
          root_cause_service: "payment-service",
        },
      ],
      service_context: {
        service: "redis-cache",
        type: "cache",
        dependencies: [],
        dependents: ["payment-service", "order-service"],
        blast_radius: 3,
      },
      metrics: {
        result_count: 4,
        context_richness: 7,
        services_found: ["order-service", "payment-service", "redis-cache"],
        llm_content_relevance: 9,
        llm_actionability: 8,
      },
    },
    naive: {
      runbook_results: [
        {
          runbook_id: "RB-001",
          runbook_title: "Redis Cache Failure Recovery",
          severity: "critical",
          step_title: "Recover Redis primary",
          content:
            "Check redis-cache pod health. Verify memory usage. Flush stale keys if memory > 90%. Restart service if unresponsive.",
        },
        {
          runbook_id: "RB-002",
          runbook_title: "Payment Service Latency Spike",
          severity: "high",
          step_title: "Reduce latency",
          content:
            "Check P95 latency in Grafana. Verify redis-cache connectivity. Scale horizontally if load-related.",
        },
      ],
      incident_results: [
        {
          id: "inc-7",
          title: "Redis memory pressure cascade",
          severity: "critical",
          resolution: "Flushed stale keys, restarted pod",
        },
        {
          id: "inc-12",
          title: "Payment timeout during peak traffic",
          severity: "high",
          resolution: "Auto-scaled to 3 replicas",
        },
      ],
      metrics: {
        result_count: 4,
        context_richness: 0,
        services_found: [],
        llm_content_relevance: 8,
        llm_actionability: 7,
      },
    },
  };
}
