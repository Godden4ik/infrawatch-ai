"use client";

import { motion } from "motion/react";
import { Activity, Radio } from "lucide-react";
import type { StreamPoint } from "@/hooks/use-metrics-stream";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricChart } from "./metric-chart";
import { Skeleton } from "@/components/ui/skeleton";

type MetricDefinition = {
  key: string;
  title: string;
  streamKey: string;
  color: string;
  areaColor: string;
  formatValue: (value: number) => string;
};

/** Maps each service to its 3 sparkline metrics and corresponding SSE stream keys */
const SERVICE_SPARKLINES: Record<string, MetricDefinition[]> = {
  "api-gateway": [
    { key: "latency", title: "P95 Latency", streamKey: "p95_latency", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatLatency },
    { key: "requestRate", title: "Request Rate", streamKey: "request_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatPerSecond },
    { key: "errorRate", title: "Error Rate", streamKey: "error_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatPerSecond },
  ],
  "payment-service": [
    { key: "latency", title: "P95 Latency", streamKey: "p95_latency", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatLatency },
    { key: "requestRate", title: "Transaction Rate", streamKey: "transaction_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatPerSecond },
    { key: "errorRate", title: "Failure Rate", streamKey: "failure_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatRatio },
  ],
  "user-service": [
    { key: "latency", title: "P95 Latency", streamKey: "p95_latency", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatLatency },
    { key: "requestRate", title: "Auth Rate", streamKey: "auth_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatPerSecond },
    { key: "errorRate", title: "Auth Failures", streamKey: "auth_failure_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatPerSecond },
  ],
  "order-service": [
    { key: "latency", title: "P95 Latency", streamKey: "p95_latency", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatLatency },
    { key: "requestRate", title: "Order Rate", streamKey: "order_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatPerSecond },
    { key: "errorRate", title: "Error Rate", streamKey: "error_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatPerSecond },
  ],
  "redis-cache": [
    { key: "latency", title: "Hit Ratio", streamKey: "hit_ratio", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatRatio },
    { key: "requestRate", title: "Hits/s", streamKey: "hits_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatPerSecond },
    { key: "errorRate", title: "Misses/s", streamKey: "misses_rate", color: "#4ade80", areaColor: "rgba(74, 222, 128, 0.18)", formatValue: formatPerSecond },
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

  return (
    <Card className="h-full" size="sm">
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
            className="border-primary/20 bg-primary/10 font-mono text-[11px] text-primary"
          >
            Live
          </Badge>
        </div>
      </CardHeader>
      <CardContent
        className={isWideService ? "grid gap-2 pt-3 lg:grid-cols-3" : "space-y-2 pt-3"}
      >
        {definitions.map((metric, index) => (
          <motion.div
            key={metric.key}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: index * 0.04 }}
          >
            <MetricChart
              title={metric.title}
              data={streamData[metric.streamKey] ?? []}
              color={metric.color}
              areaColor={metric.areaColor}
              formatValue={metric.formatValue}
            />
          </motion.div>
        ))}
      </CardContent>
    </Card>
  );
}
