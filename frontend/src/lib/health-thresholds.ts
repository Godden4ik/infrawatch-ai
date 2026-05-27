export type HealthLevel = "healthy" | "warn" | "critical";

type Direction = "above" | "below";

interface Threshold {
  warn: number;
  critical: number;
  direction: Direction;
}

// Anchored to CLAUDE.md baselines. `direction: "above"` means values higher than
// the threshold are bad (latencies, error rates). `direction: "below"` means
// lower values are bad (cache hit ratio).
export const THRESHOLDS: Record<string, Record<string, Threshold>> = {
  "api-gateway": {
    p95_latency: { warn: 0.2, critical: 0.4, direction: "above" },
    error_rate: { warn: 0.5, critical: 2, direction: "above" },
  },
  "payment-service": {
    p95_latency: { warn: 1.2, critical: 2, direction: "above" },
    failure_rate: { warn: 0.05, critical: 0.1, direction: "above" },
  },
  "user-service": {
    p95_latency: { warn: 0.2, critical: 0.35, direction: "above" },
    auth_failure_rate: { warn: 0.5, critical: 2, direction: "above" },
  },
  "order-service": {
    p95_latency: { warn: 3, critical: 5, direction: "above" },
    error_rate: { warn: 0.5, critical: 2, direction: "above" },
  },
  "redis-cache": {
    hit_ratio: { warn: 0.7, critical: 0.5, direction: "below" },
  },
};

export function evaluateMetric(
  service: string,
  metricKey: string,
  value: number | null | undefined,
): HealthLevel {
  if (value == null || !Number.isFinite(value)) return "healthy";
  const t = THRESHOLDS[service]?.[metricKey];
  if (!t) return "healthy";
  if (t.direction === "above") {
    if (value >= t.critical) return "critical";
    if (value >= t.warn) return "warn";
    return "healthy";
  }
  if (value <= t.critical) return "critical";
  if (value <= t.warn) return "warn";
  return "healthy";
}

// CSS variable names. Resolved at render time in chart components (SVG attrs
// don't accept var()). Use the helper in metric-chart.tsx for resolution.
export const LEVEL_COLORS: Record<
  HealthLevel,
  { colorVar: string; areaVar: string }
> = {
  healthy: { colorVar: "--status-healthy", areaVar: "--status-healthy-soft" },
  warn: { colorVar: "--status-degraded", areaVar: "--status-degraded-soft" },
  critical: { colorVar: "--status-critical", areaVar: "--status-critical-soft" },
};

export const LEVEL_BADGE: Record<
  HealthLevel,
  { label: string; className: string }
> = {
  healthy: {
    label: "Healthy",
    className: "border-status-healthy/30 bg-status-healthy-soft text-status-healthy",
  },
  warn: {
    label: "Degraded",
    className: "border-status-degraded/30 bg-status-degraded-soft text-status-degraded",
  },
  critical: {
    label: "Critical",
    className: "border-status-critical/30 bg-status-critical-soft text-status-critical",
  },
};

export function worstLevel(levels: HealthLevel[]): HealthLevel {
  if (levels.includes("critical")) return "critical";
  if (levels.includes("warn")) return "warn";
  return "healthy";
}
