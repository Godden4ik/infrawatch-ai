import type { RagResult } from "@/services/rag/schema";

export function getMockRagResult(query: string): RagResult {
  return {
    query,
    graphrag: {
      runbook_results: [
        {
          id: "rb-1",
          title: "Redis Cache Failure Recovery",
          severity: "critical",
          service: "redis-cache",
          steps: [
            "Check redis-cache pod health",
            "Verify memory usage",
            "Flush stale keys if memory > 90%",
            "Restart service if unresponsive",
          ],
          graph_context: {
            downstream_services: ["payment-service", "order-service"],
            blast_radius: 3,
          },
        },
        {
          id: "rb-2",
          title: "Payment Service Latency Spike",
          severity: "high",
          service: "payment-service",
          steps: [
            "Check P95 latency in Grafana",
            "Verify redis-cache connectivity",
            "Scale horizontally if load-related",
          ],
          graph_context: {
            upstream_dependency: "redis-cache",
            blast_radius: 1,
          },
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
    },
    naive: {
      runbook_results: [
        {
          id: "rb-1",
          title: "Redis Cache Failure Recovery",
          severity: "critical",
          steps: [
            "Check redis-cache pod health",
            "Verify memory usage",
            "Flush stale keys if memory > 90%",
            "Restart service if unresponsive",
          ],
        },
        {
          id: "rb-2",
          title: "Payment Service Latency Spike",
          severity: "high",
          steps: [
            "Check P95 latency in Grafana",
            "Verify redis-cache connectivity",
            "Scale horizontally if load-related",
          ],
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
    },
  };
}
