import type { StreamEvent } from "@/services/pipeline/schema";

const MONITOR_TOKENS = `Analyzing infrastructure metrics...

Detected anomalies:
- redis-cache: hit_ratio dropped to 23% (threshold: 50%)
- payment-service: P95 latency at 4200ms (threshold: 2000ms)
- order-service: error rate at 12% (threshold: 5%)

\`\`\`json
[
  {"service": "redis-cache", "metric": "cache_hit_ratio", "value": 0.23, "threshold": 0.5, "severity": "critical"},
  {"service": "payment-service", "metric": "p95_latency_ms", "value": 4200, "threshold": 2000, "severity": "high"},
  {"service": "order-service", "metric": "error_rate", "value": 0.12, "threshold": 0.05, "severity": "high"}
]
\`\`\``;

const ANALYST_TOKENS = `Analyzing service topology for root cause...

Querying Neo4j graph for blast radius of redis-cache...

Root cause analysis:
1. **redis-cache** is the primary failure point (cache_hit_ratio: 23%)
2. **payment-service** depends on redis-cache for session caching → latency spike is downstream effect
3. **order-service** calls payment-service AND depends on redis-cache → double impact

Blast radius: redis-cache → payment-service, order-service → api-gateway (3 affected services)

Historical precedent: Similar to INC-7 (redis memory pressure cascade, 2024-11-15)`;

const RESPONDER_TOKENS = `## Remediation Plan

### Immediate Actions (P0)
1. **Flush redis-cache stale keys**: \`redis-cli FLUSHDB\` — free memory immediately
2. **Restart redis-cache pod**: \`kubectl rollout restart deployment/redis-cache\`

### Follow-up (P1)
3. **Monitor recovery**: Watch payment-service P95 latency return to <2000ms baseline
4. **Verify order-service**: Confirm error rate drops below 5% threshold
5. **Scale if needed**: \`kubectl scale deployment/payment-service --replicas=3\`

### Prevention
- Set redis maxmemory-policy to allkeys-lru
- Add redis memory alert at 80% threshold
- Implement circuit breaker between order-service → payment-service`;

export function generateMockPipelineEvents(): StreamEvent[] {
  const events: StreamEvent[] = [];

  // Monitor agent
  for (const chunk of MONITOR_TOKENS.match(/.{1,20}/g) ?? []) {
    events.push({ type: "token", agent: "monitor_node", content: chunk });
  }
  events.push({
    type: "tool_start",
    agent: "monitor_node",
    tool: "execute_promql",
  });
  events.push({
    type: "tool_end",
    agent: "monitor_node",
    output: '{"status":"success","data":{"result":[{"metric":{"service":"redis-cache"},"value":[1710000000,"0.23"]}]}}',
  });
  events.push({
    type: "agent_complete",
    agent: "monitor_node",
    result: { anomalies_found: 3 },
  });

  // Analyst agent
  for (const chunk of ANALYST_TOKENS.match(/.{1,20}/g) ?? []) {
    events.push({ type: "token", agent: "analyst_node", content: chunk });
  }
  events.push({
    type: "tool_start",
    agent: "analyst_node",
    tool: "get_blast_radius",
  });
  events.push({
    type: "tool_end",
    agent: "analyst_node",
    output: '{"service":"redis-cache","affected":["payment-service","order-service","api-gateway"]}',
  });
  events.push({
    type: "tool_start",
    agent: "analyst_node",
    tool: "find_similar_incidents",
  });
  events.push({
    type: "tool_end",
    agent: "analyst_node",
    output: '{"incidents":[{"id":"inc-7","title":"redis memory pressure cascade"}]}',
  });
  events.push({
    type: "agent_complete",
    agent: "analyst_node",
    result: { root_cause: "redis-cache", affected_count: 3 },
  });

  // Responder agent
  for (const chunk of RESPONDER_TOKENS.match(/.{1,20}/g) ?? []) {
    events.push({ type: "token", agent: "responder_node", content: chunk });
  }
  events.push({
    type: "tool_start",
    agent: "responder_node",
    tool: "get_runbook_for_service",
  });
  events.push({
    type: "tool_end",
    agent: "responder_node",
    output: '{"runbook":"Redis Cache Failure Recovery","steps":["Check pod health","Verify memory","Flush stale keys"]}',
  });
  events.push({
    type: "agent_complete",
    agent: "responder_node",
    result: { actions_proposed: 5 },
  });

  events.push({ type: "done" });

  return events;
}
