import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import { anomalyStatusResponseSchema, type AnomalyStatusResponse } from "./schema";

export const anomalyKeys = {
  all: ["anomaly"] as const,
  history: () => [...anomalyKeys.all, "history"] as const,
  status: () => [...anomalyKeys.all, "status"] as const,
};

export const anomalyStatusQueryOptions = queryOptions({
  queryKey: anomalyKeys.status(),
  queryFn: async () => {
    const raw = await apiClient<unknown>("/api/anomaly/status");
    return anomalyStatusResponseSchema.parse(raw) satisfies AnomalyStatusResponse;
  },
  refetchInterval: 5_000,
});
