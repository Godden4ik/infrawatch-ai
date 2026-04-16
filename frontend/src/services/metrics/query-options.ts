import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import { mapPrometheusResultToMetricPoints } from "./schema";

export const metricsKeys = {
  all: ["metrics"] as const,
  query: (promql: string) => [...metricsKeys.all, "query", promql] as const,
  range: (promql: string, start: string, end: string, step: string) =>
    [...metricsKeys.all, "range", promql, start, end, step] as const,
};

export function metricsQueryOptions(promql: string) {
  return queryOptions({
    queryKey: metricsKeys.query(promql),
    queryFn: () =>
      apiClient<unknown>("/api/metrics/api/v1/query", {
        params: { query: promql },
      }).then(mapPrometheusResultToMetricPoints),
    refetchInterval: 15_000,
  });
}

export function metricsRangeQueryOptions(
  promql: string,
  start: string,
  end: string,
  step: string,
) {
  return queryOptions({
    queryKey: metricsKeys.range(promql, start, end, step),
    queryFn: () =>
      apiClient<unknown>("/api/metrics/api/v1/query_range", {
        params: { query: promql, start, end, step },
      }).then(mapPrometheusResultToMetricPoints),
  });
}
