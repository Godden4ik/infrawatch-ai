import { randPastDate, rand } from "@ngneat/falso";
import type {
  TopologyResponse,
  BlastRadiusResponse,
  Runbook,
  Incident,
} from "@/services/graph/schema";

export const mockTopology: TopologyResponse = {
  nodes: [
    { name: "api-gateway", type: "gateway", labels: ["Service", "Gateway"] },
    { name: "payment-service", type: "backend", labels: ["Service", "Backend"] },
    { name: "user-service", type: "backend", labels: ["Service", "Backend"] },
    { name: "order-service", type: "backend", labels: ["Service", "Backend"] },
    { name: "redis-cache", type: "cache", labels: ["Service", "Cache"] },
  ],
  edges: [
    { source: "api-gateway", relationship: "ROUTES_TO", target: "payment-service" },
    { source: "api-gateway", relationship: "ROUTES_TO", target: "user-service" },
    { source: "api-gateway", relationship: "ROUTES_TO", target: "order-service" },
    { source: "payment-service", relationship: "DEPENDS_ON", target: "redis-cache" },
    { source: "order-service", relationship: "DEPENDS_ON", target: "redis-cache" },
    { source: "order-service", relationship: "CALLS", target: "payment-service" },
    { source: "order-service", relationship: "CALLS", target: "user-service" },
  ],
};

const BLAST_RADIUS_MAP: Record<string, string[]> = {
  "redis-cache": ["payment-service", "order-service", "api-gateway"],
  "payment-service": ["order-service", "api-gateway"],
  "user-service": ["order-service", "api-gateway"],
  "order-service": ["api-gateway"],
  "api-gateway": [],
};

export function getMockBlastRadius(service: string): BlastRadiusResponse {
  return {
    service,
    affected_services: BLAST_RADIUS_MAP[service] ?? [],
  };
}

export const mockRunbooks: Record<string, Runbook[]> = {
  "redis-cache": [
    {
      id: "rb-1",
      title: "Redis Cache Failure Recovery",
      severity: "critical",
      steps: [
        "Check redis-cache pod health: kubectl get pods -l app=redis-cache",
        "Verify memory usage: redis-cli INFO memory",
        "Flush stale keys if memory > 90%: redis-cli FLUSHDB",
        "Restart service if unresponsive: kubectl rollout restart deployment/redis-cache",
        "Verify dependent services recover: check payment-service, order-service health",
      ],
    },
  ],
  "payment-service": [
    {
      id: "rb-2",
      title: "Payment Service Latency Spike",
      severity: "high",
      steps: [
        "Check P95 latency in Grafana dashboard",
        "Verify redis-cache connectivity",
        "Check database connection pool utilization",
        "Scale horizontally if load-related: kubectl scale deployment/payment-service --replicas=3",
      ],
    },
  ],
  "api-gateway": [
    {
      id: "rb-3",
      title: "API Gateway Error Rate Escalation",
      severity: "critical",
      steps: [
        "Check upstream service health",
        "Review rate limiting configuration",
        "Check for circuit breaker trips",
        "Verify DNS resolution for upstream services",
      ],
    },
  ],
  "order-service": [
    {
      id: "rb-4",
      title: "Order Service Database Timeout",
      severity: "high",
      steps: [
        "Check database connection pool: ORDER_DB_POOL_SIZE",
        "Verify slow query log",
        "Check redis-cache for session data availability",
        "Restart if connection pool exhausted",
      ],
    },
  ],
  "user-service": [
    {
      id: "rb-5",
      title: "User Service Auth Failures",
      severity: "medium",
      steps: [
        "Check JWT validation errors in logs",
        "Verify user-service <-> api-gateway connectivity",
        "Check for expired certificates",
      ],
    },
  ],
};

export function getMockRunbooks(service: string): Runbook[] {
  return mockRunbooks[service] ?? [];
}

export const mockIncidents: Incident[] = Array.from({ length: 15 }, (_, i) => {
  const services = ["redis-cache", "payment-service", "order-service", "api-gateway", "user-service"];
  const severities = ["critical", "high", "medium", "low"];
  const resolutions = [
    "Auto-scaled horizontally to 3 replicas",
    "Redis cache flushed and restarted",
    "Circuit breaker reset after upstream recovery",
    "Database connection pool expanded from 10 to 25",
    "DNS resolution fixed by restarting coredns",
    null,
  ];

  return {
    id: `inc-${i + 1}`,
    title: `${rand(services)} ${rand(["latency spike", "error rate increase", "timeout cascade", "memory pressure", "connection exhaustion"])} incident`,
    severity: rand(severities),
    resolution: rand(resolutions),
    timestamp: randPastDate({ years: 1 }).toISOString(),
  };
});

export function getMockIncidents(service?: string): Incident[] {
  if (!service) return mockIncidents;
  return mockIncidents.filter((inc) =>
    inc.title.toLowerCase().includes(service.toLowerCase()),
  );
}
