import type { RagResult } from "@/services/rag/schema";

const MOCK_GRAPHRAG_CHUNKS = [
  {
    chunk_id: "ND-004-C1",
    chunk_index: 1,
    content:
      "Cascade failure patterns arise when a dependency failure propagates upstream. The retry storm is the most common cascade amplifier: when service A fails, its callers retry aggressively, multiplying load on an already-degraded system. Exponential backoff with jitter is the standard mitigation...",
    document_id: "ND-004",
    document_title: "SRE Error Budgets, Blast Radius Estimation, and Cascade Failure Modes",
    source_system: "sre-theory",
    related_services: [],
    score: 0.847,
  },
  {
    chunk_id: "ND-001-C0",
    chunk_index: 0,
    content:
      "When memory.available drops below the eviction threshold, the kubelet begins terminating pods to reclaim memory. The eviction order follows Quality of Service classes: BestEffort pods are evicted first because they have no memory requests or limits defined...",
    document_id: "ND-001",
    document_title: "Kubernetes Pod Eviction and Memory Pressure Management",
    source_system: "kubernetes",
    related_services: [],
    score: 0.791,
  },
  {
    chunk_id: "ND-002-C1",
    chunk_index: 1,
    content:
      "Connection pool exhaustion manifests as latency spikes: when the pool is saturated, new queries wait in queue rather than executing. If the queue depth limit is reached, PgBouncer rejects connections with 'no more connections allowed'. This cascades to the application layer as timeout errors...",
    document_id: "ND-002",
    document_title: "PostgreSQL Connection Pool Exhaustion and Query Latency Optimization",
    source_system: "postgresql",
    related_services: [],
    score: 0.763,
  },
];

const MOCK_NAIVE_CHUNKS = [
  {
    chunk_id: "ND-004-C1",
    content:
      "Cascade failure patterns arise when a dependency failure propagates upstream. The retry storm is the most common cascade amplifier: when service A fails, its callers retry aggressively, multiplying load on an already-degraded system. Exponential backoff with jitter is the standard mitigation...",
    document_title: "SRE Error Budgets, Blast Radius Estimation, and Cascade Failure Modes",
    score: 0.847,
  },
  {
    chunk_id: "ND-001-C0",
    content:
      "When memory.available drops below the eviction threshold, the kubelet begins terminating pods to reclaim memory. The eviction order follows Quality of Service classes: BestEffort pods are evicted first because they have no memory requests or limits defined...",
    document_title: "Kubernetes Pod Eviction and Memory Pressure Management",
    score: 0.791,
  },
  {
    chunk_id: "ND-002-C1",
    content:
      "Connection pool exhaustion manifests as latency spikes: when the pool is saturated, new queries wait in queue rather than executing. If the queue depth limit is reached, PgBouncer rejects connections. This cascades to the application layer as timeout errors...",
    document_title: "PostgreSQL Connection Pool Exhaustion and Query Latency Optimization",
    score: 0.763,
  },
];

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
      chunk_results: MOCK_GRAPHRAG_CHUNKS,
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
      chunk_results: MOCK_NAIVE_CHUNKS,
    },
  };
}
