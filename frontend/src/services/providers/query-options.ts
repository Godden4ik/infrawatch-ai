import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import type { ProvidersResponse, HealthResponse } from "./schema";

export const providerKeys = {
  all: ["providers"] as const,
  list: () => [...providerKeys.all, "list"] as const,
  health: (id: string) => [...providerKeys.all, "health", id] as const,
};

export const providerQueries = {
  list: () =>
    queryOptions({
      queryKey: providerKeys.list(),
      queryFn: () => apiClient<ProvidersResponse>("/api/providers/list"),
      staleTime: 30_000,
    }),
  health: (providerId: string) =>
    queryOptions({
      queryKey: providerKeys.health(providerId),
      queryFn: () =>
        apiClient<HealthResponse>(`/api/providers/${providerId}/health`),
      enabled: false,
    }),
};
