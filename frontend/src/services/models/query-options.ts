import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import type { ModelsResponse } from "./schema";

export const modelKeys = {
  all: ["models"] as const,
  list: () => [...modelKeys.all, "list"] as const,
};

export const modelQueries = {
  list: () =>
    queryOptions({
      queryKey: modelKeys.list(),
      queryFn: () => apiClient<ModelsResponse>("/api/models/list"),
      staleTime: 30_000,
      refetchInterval: 30_000,
    }),
};
