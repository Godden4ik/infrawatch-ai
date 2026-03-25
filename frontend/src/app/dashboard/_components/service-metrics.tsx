"use client";

import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { metricsRangeQueryOptions } from "@/services/metrics/query-options";
import type { PrometheusResult } from "@/services/metrics/schema";
import { MetricChart } from "./metric-chart";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity } from "lucide-react";

type ServiceConfig = {
  latency: string;
  requestRate: string;
  errorRate: string;
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

function toChartData(result: PrometheusResult | undefined) {
  if (!result?.data?.result?.[0]?.values) return [];
  return result.data.result[0].values.map(([ts, val]) => ({
    time: new Date(ts * 1000).toISOString(),
    value: parseFloat(val),
  }));
}

function useTimeRange() {
  const end = Math.floor(Date.now() / 1000);
  const start = end - 3600;
  return { start: String(start), end: String(end), step: "60" };
}

export function ServiceMetrics({ serviceName }: { serviceName: string }) {
  const { start, end, step } = useTimeRange();
  const config = SERVICE_METRICS[serviceName];

  const latency = useQuery(
    metricsRangeQueryOptions(config?.latency ?? "", start, end, step),
  );
  const requestRate = useQuery(
    metricsRangeQueryOptions(config?.requestRate ?? "", start, end, step),
  );
  const errorRate = useQuery(
    metricsRangeQueryOptions(config?.errorRate ?? "", start, end, step),
  );

  const isLoading = latency.isLoading || requestRate.isLoading || errorRate.isLoading;

  if (!config) return null;

  if (isLoading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Activity className="text-muted-foreground h-4 w-4" />
          <h3 className="font-mono text-sm font-medium">{serviceName}</h3>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const labels = CHART_LABELS[serviceName] ?? {
    latency: "P95 Latency",
    requestRate: "Request Rate",
    errorRate: "Error Rate",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-primary" />
        <h3 className="font-mono text-sm font-medium">{serviceName}</h3>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {[
          { title: labels.latency, data: toChartData(latency.data), unit: serviceName === "redis-cache" ? "" : "s", color: "#3b82f6" },
          { title: labels.requestRate, data: toChartData(requestRate.data), unit: "/s", color: "#22c55e" },
          { title: labels.errorRate, data: toChartData(errorRate.data), unit: "/s", color: "#ef4444" },
        ].map((chart, i) => (
          <motion.div
            key={chart.title}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: i * 0.06 }}
          >
            <MetricChart {...chart} />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
