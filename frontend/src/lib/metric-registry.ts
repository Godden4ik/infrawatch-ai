// frontend/src/lib/metric-registry.ts

export type MetricFormat = "latency" | "rate" | "ratio" | "bytes" | "count" | "currency";

export interface MetricDef {
  key: string;
  label: string;
  format: MetricFormat;
}

export interface ServiceMetricGroup {
  service: string;
  label: string;
  /**
   * CSS variable name for the group-level fallback chart color, e.g. `--brand`.
   * Per-metric color is derived via `getMetricColorVar(metric)` and should be
   * preferred where possible.
   */
  colorVar: string;
  metrics: MetricDef[];
}

/**
 * Maps a metric to a semantic CSS variable for chart color. Error/failure
 * signals always get the error token; otherwise we route by format:
 * latencies → latency, rates/counts/bytes → rate, ratios/currency → success.
 */
export function getMetricColorVar(metric: MetricDef): string {
  const k = metric.key.toLowerCase();
  if (k.includes("error") || k.includes("failure") || k.includes("evict")) {
    return "--metric-error";
  }
  switch (metric.format) {
    case "latency":
      return "--metric-latency";
    case "ratio":
    case "currency":
      return "--metric-success";
    case "rate":
    case "count":
    case "bytes":
    default:
      return "--metric-rate";
  }
}

export const METRIC_GROUPS: ServiceMetricGroup[] = [
  {
    service: "api-gateway",
    label: "API Gateway",
    colorVar: "--brand",
    metrics: [
      { key: "p95_latency", label: "P95 Latency", format: "latency" },
      { key: "request_rate", label: "Request Rate", format: "rate" },
      { key: "error_rate", label: "Error Rate", format: "rate" },
      { key: "active_connections", label: "Active Connections", format: "count" },
    ],
  },
  {
    service: "payment-service",
    label: "Payment Service",
    colorVar: "--brand",
    metrics: [
      { key: "p95_latency", label: "P95 Latency", format: "latency" },
      { key: "transaction_rate", label: "Transaction Rate", format: "rate" },
      { key: "failure_rate", label: "Failure Rate", format: "ratio" },
      { key: "pending_transactions", label: "Pending Txns", format: "count" },
      { key: "revenue_rate", label: "Revenue Rate", format: "currency" },
    ],
  },
  {
    service: "user-service",
    label: "User Service",
    colorVar: "--brand",
    metrics: [
      { key: "p95_latency", label: "P95 Latency", format: "latency" },
      { key: "auth_rate", label: "Auth Rate", format: "rate" },
      { key: "auth_failure_rate", label: "Auth Failures", format: "rate" },
      { key: "active_sessions", label: "Active Sessions", format: "count" },
      { key: "registration_rate", label: "Registrations", format: "rate" },
    ],
  },
  {
    service: "order-service",
    label: "Order Service",
    colorVar: "--brand",
    metrics: [
      { key: "p95_latency", label: "P95 Latency", format: "latency" },
      { key: "order_rate", label: "Order Rate", format: "rate" },
      { key: "queue_depth", label: "Queue Depth", format: "count" },
      { key: "error_rate", label: "Error Rate", format: "rate" },
    ],
  },
  {
    service: "redis-cache",
    label: "Redis Cache",
    colorVar: "--brand",
    metrics: [
      { key: "hit_ratio", label: "Hit Ratio", format: "ratio" },
      { key: "hits_rate", label: "Hits/s", format: "rate" },
      { key: "misses_rate", label: "Misses/s", format: "rate" },
      { key: "memory_used", label: "Memory Used", format: "bytes" },
      { key: "memory_max", label: "Memory Max", format: "bytes" },
      { key: "connected_clients", label: "Connected Clients", format: "count" },
      { key: "evicted_keys_rate", label: "Evicted Keys/s", format: "rate" },
      { key: "total_keys", label: "Total Keys", format: "count" },
    ],
  },
];

export function formatMetricValue(value: number, format: MetricFormat): string {
  switch (format) {
    case "latency":
      if (value >= 1) return `${value.toFixed(2)}s`;
      if (value >= 0.1) return `${(value * 1000).toFixed(0)}ms`;
      return `${(value * 1000).toFixed(1)}ms`;
    case "rate":
      if (value >= 100) return `${value.toFixed(0)}/s`;
      if (value >= 10) return `${value.toFixed(1)}/s`;
      return `${value.toFixed(3)}/s`;
    case "ratio":
      return `${(value * 100).toFixed(1)}%`;
    case "bytes":
      if (value >= 1_073_741_824) return `${(value / 1_073_741_824).toFixed(1)} GB`;
      if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${value.toFixed(0)} B`;
    case "count":
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return value.toFixed(0);
    case "currency":
      return `$${value.toFixed(2)}/s`;
  }
}
