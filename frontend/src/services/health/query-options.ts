import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import type { HealthResponse } from "./schema";

export const healthKeys = {
  all: ["health"] as const,
  status: () => [...healthKeys.all, "status"] as const,
};

export const healthQueryOptions = queryOptions({
  queryKey: healthKeys.status(),
  queryFn: () => apiClient<HealthResponse>("/api/health/health"),
  refetchInterval: 30_000,
});
