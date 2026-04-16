"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { useQueries } from "@tanstack/react-query";
import { Activity, Clock3 } from "lucide-react";
import { metricsRangeQueryOptions } from "@/services/metrics/query-options";
import type { MetricPoint } from "@/services/metrics/schema";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MetricChart } from "./metric-chart";
import { Skeleton } from "@/components/ui/skeleton";

type ServiceConfig = {
  latency: string;
  requestRate: string;
  errorRate: string;
};

type MetricDefinition = {
  key: "latency" | "requestRate" | "errorRate";
  title: string;
  query: string;
  color: string;
  areaColor: string;
  formatValue: (value: number) => string;
};

const SERVICE_METRICS: Record<string, ServiceConfig> = {
  "api-gateway": {
    latency: `histogram_quantile(0.95, rate(gateway_request_duration_seconds_bucket[5m]))`,
    requestRate: `rate(gateway_requests_total[5m])`,
    errorRate: `rate(gateway_requests_total{status="5xx"}[5m])`,
  },
  "payment-service": {
    latency: `histogram_quantile(0.95, rate(payment_processing_duration_seconds_bucket[5m]))`,
    requestRate: `rate(payment_transactions_total[5m])`,
    errorRate: `rate(payment_transactions_total{status="failed"}[5m])`,
  },
  "user-service": {
    latency: `histogram_quantile(0.95, rate(user_request_duration_seconds_bucket[5m]))`,
    requestRate: `rate(user_auth_attempts_total[5m])`,
    errorRate: `rate(user_auth_attempts_total{result="failure"}[5m])`,
  },
  "order-service": {
    latency: `histogram_quantile(0.95, rate(order_processing_duration_seconds_bucket[5m]))`,
    requestRate: `rate(order_processed_total[5m])`,
    errorRate: `rate(order_errors_total[5m])`,
  },
  "redis-cache": {
    latency: `redis_cache_hit_ratio`,
    requestRate: `rate(redis_cache_hits_total[5m])`,
    errorRate: `rate(redis_cache_misses_total[5m])`,
  },
};

const CHART_LABELS: Record<string, { latency: string; requestRate: string; errorRate: string }> = {
  "redis-cache": { latency: "Hit Ratio", requestRate: "Hits/s", errorRate: "Misses/s" },
};

function isMetricSeries(data: unknown): data is MetricPoint[] {
  return (
    Array.isArray(data) &&
    data.every(
      (point) =>
        !!point &&
        typeof point === "object" &&
        typeof point.time === "string" &&
        typeof point.value === "number" &&
        Number.isFinite(point.value),
    )
  );
}

function useTimeRange() {
  const [end, setEnd] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setEnd(Math.floor(Date.now() / 1000));
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, []);

  const start = end - 3600;
  return { start: String(start), end: String(end), step: "60" };
}

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

const GREEN_METRIC_COLOR = "#4ade80";
const GREEN_METRIC_AREA = "rgba(74, 222, 128, 0.18)";

function getMetricDefinitions(serviceName: string, config: ServiceConfig): MetricDefinition[] {
  const labels = CHART_LABELS[serviceName] ?? {
    latency: "P95 Latency",
    requestRate: "Request Rate",
    errorRate: "Error Rate",
  };

  if (serviceName === "redis-cache") {
    return [
      {
        key: "latency",
        title: labels.latency,
        query: config.latency,
        color: GREEN_METRIC_COLOR,
        areaColor: GREEN_METRIC_AREA,
        formatValue: formatRatio,
      },
      {
        key: "requestRate",
        title: labels.requestRate,
        query: config.requestRate,
        color: GREEN_METRIC_COLOR,
        areaColor: GREEN_METRIC_AREA,
        formatValue: formatPerSecond,
      },
      {
        key: "errorRate",
        title: labels.errorRate,
        query: config.errorRate,
        color: GREEN_METRIC_COLOR,
        areaColor: GREEN_METRIC_AREA,
        formatValue: formatPerSecond,
      },
    ];
  }

  return [
    {
      key: "latency",
      title: labels.latency,
      query: config.latency,
      color: GREEN_METRIC_COLOR,
      areaColor: GREEN_METRIC_AREA,
      formatValue: formatLatency,
    },
    {
      key: "requestRate",
      title: labels.requestRate,
      query: config.requestRate,
      color: GREEN_METRIC_COLOR,
      areaColor: GREEN_METRIC_AREA,
      formatValue: formatPerSecond,
    },
    {
      key: "errorRate",
      title: labels.errorRate,
      query: config.errorRate,
      color: GREEN_METRIC_COLOR,
      areaColor: GREEN_METRIC_AREA,
      formatValue: formatPerSecond,
    },
  ];
}

export function ServiceMetrics({ serviceName }: { serviceName: string }) {
  const { start, end, step } = useTimeRange();
  const config = SERVICE_METRICS[serviceName] ?? SERVICE_METRICS["api-gateway"];
  const isKnownService = serviceName in SERVICE_METRICS;
  const isWideService = serviceName === "redis-cache";

  const metricDefinitions = getMetricDefinitions(serviceName, config);

  const metrics = useQueries({
    queries: metricDefinitions.map((metric) =>
      metricsRangeQueryOptions(metric.query, start, end, step),
    ),
  });

  if (!isKnownService) return null;

  const isLoading = metrics.some((metric) => metric.isPending);
  const hasError = metrics.some((metric) => metric.isError);

  if (isLoading) {
    return (
      <Card className="h-full" size="sm">
        <CardHeader className="border-b border-border/60">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <CardTitle className="font-mono text-sm">{serviceName}</CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-[11px]">
              Loading
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
              <Clock3 className="h-3.5 w-3.5" />
              <span>Last 60m</span>
              <span className="text-muted-foreground/50">·</span>
              <span>1m resolution</span>
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
        {hasError ? (
          <div className="border-border bg-background/50 px-3 py-4 font-mono text-xs text-muted-foreground ring-1 ring-inset ring-border/70">
            Metric stream unavailable.
          </div>
        ) : (
          metricDefinitions.map((metric, index) => (
            <motion.div
              key={metric.key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
            >
              <MetricChart
                title={metric.title}
                data={isMetricSeries(metrics[index]?.data) ? metrics[index].data : []}
                color={metric.color}
                areaColor={metric.areaColor}
                formatValue={metric.formatValue}
              />
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
