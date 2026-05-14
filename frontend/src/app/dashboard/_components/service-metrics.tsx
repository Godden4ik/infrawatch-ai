"use client";

import { motion } from "motion/react";
import { Activity, AlertTriangle, CheckCircle2, Radio } from "lucide-react";
import type { StreamPoint } from "@/hooks/use-metrics-stream";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricChart } from "./metric-chart";
import { Skeleton } from "@/components/ui/skeleton";
import {
  evaluateMetric,
  LEVEL_BADGE,
  LEVEL_COLORS,
  worstLevel,
  type HealthLevel,
} from "@/lib/health-thresholds";
import { cn } from "@/lib/utils";

type MetricDefinition = {
  key: string;
  title: string;
  streamKey: string;
  formatValue: (value: number) => string;
};

const SERVICE_SPARKLINES: Record<string, MetricDefinition[]> = {
  "api-gateway": [
    { key: "latency", title: "P95 Latency", streamKey: "p95_latency", formatValue: formatLatency },
    { key: "requestRate", title: "Request Rate", streamKey: "request_rate", formatValue: formatPerSecond },
    { key: "errorRate", title: "Error Rate", streamKey: "error_rate", formatValue: formatPerSecond },
  ],
  "payment-service": [
    { key: "latency", title: "P95 Latency", streamKey: "p95_latency", formatValue: formatLatency },
    { key: "requestRate", title: "Transaction Rate", streamKey: "transaction_rate", formatValue: formatPerSecond },
    { key: "errorRate", title: "Failure Rate", streamKey: "failure_rate", formatValue: formatRatio },
  ],
  "user-service": [
    { key: "latency", title: "P95 Latency", streamKey: "p95_latency", formatValue: formatLatency },
    { key: "requestRate", title: "Auth Rate", streamKey: "auth_rate", formatValue: formatPerSecond },
    { key: "errorRate", title: "Auth Failures", streamKey: "auth_failure_rate", formatValue: formatPerSecond },
  ],
  "order-service": [
    { key: "latency", title: "P95 Latency", streamKey: "p95_latency", formatValue: formatLatency },
    { key: "requestRate", title: "Order Rate", streamKey: "order_rate", formatValue: formatPerSecond },
    { key: "errorRate", title: "Error Rate", streamKey: "error_rate", formatValue: formatPerSecond },
  ],
  "redis-cache": [
    { key: "latency", title: "Hit Ratio", streamKey: "hit_ratio", formatValue: formatRatio },
    { key: "requestRate", title: "Hits/s", streamKey: "hits_rate", formatValue: formatPerSecond },
    { key: "errorRate", title: "Misses/s", streamKey: "misses_rate", formatValue: formatPerSecond },
  ],
};

function formatLatency(value: number) {
  if (value >= 1) return `${value.toFixed(2)}s`;
  if (value >= 0.1) return `${(value * 1000).toFixed(0)}ms`;
  return `${(value * 1000).toFixed(1)}ms`;
}

function formatPerSecond(value: number) {
  if (value >= 100) return `${value.toFixed(0)}/s`;
  if (value >= 10) return `${value.toFixed(1)}/s`;
  return `${value.toFixed(3)}/s`;
}

function formatRatio(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function latestValue(points: StreamPoint[] | undefined): number | null {
  if (!points || points.length === 0) return null;
  const v = points[points.length - 1]?.value;
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

interface ServiceMetricsProps {
  serviceName: string;
  streamData?: Record<string, StreamPoint[]>;
}

export function ServiceMetrics({ serviceName, streamData }: ServiceMetricsProps) {
  const definitions = SERVICE_SPARKLINES[serviceName];
  if (!definitions) return null;

  const isWideService = serviceName === "redis-cache";
  const hasData = streamData && Object.values(streamData).some((pts) => pts.length > 0);

  if (!streamData || !hasData) {
    return (
      <Card className="h-full" size="sm">
        <CardHeader className="border-b border-border/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="font-mono text-sm">{serviceName}</CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-[11px]">
              Connecting
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2 pt-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-34" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const metricLevels: HealthLevel[] = definitions.map((metric) =>
    evaluateMetric(serviceName, metric.streamKey, latestValue(streamData[metric.streamKey])),
  );
  const serviceLevel = worstLevel(metricLevels);
  const badgeCfg = LEVEL_BADGE[serviceLevel];
  const StatusIcon =
    serviceLevel === "healthy" ? CheckCircle2 : AlertTriangle;

  return (
    <Card
      className={cn(
        "h-full transition-colors",
        serviceLevel === "warn" && "ring-1 ring-yellow-500/40",
        serviceLevel === "critical" && "ring-1 ring-destructive/50",
      )}
      size="sm"
    >
      <CardHeader className="border-b border-border/60">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="font-mono text-sm">{serviceName}</CardTitle>
            </div>
            <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
              <Radio className="h-3.5 w-3.5" />
              <span>Live · 2s</span>
            </div>
          </div>
          <Badge
            variant="outline"
            className={cn("font-mono text-[11px]", badgeCfg.className)}
          >
            <StatusIcon className="mr-1 h-3 w-3" />
            {badgeCfg.label}
          </Badge>
        </div>
      </CardHeader>
      <CardContent
        className={isWideService ? "grid gap-2 pt-3 lg:grid-cols-3" : "space-y-2 pt-3"}
      >
        {definitions.map((metric, index) => {
          const level = metricLevels[index];
          const palette = LEVEL_COLORS[level];
          return (
            <motion.div
              key={metric.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
            >
              <MetricChart
                title={metric.title}
                data={streamData[metric.streamKey] ?? []}
                color={palette.color}
                areaColor={palette.areaColor}
                formatValue={metric.formatValue}
              />
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
