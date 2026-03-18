import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import type {
  TopologyResponse,
  BlastRadiusResponse,
  Runbook,
  Incident,
} from "./schema";

export const graphKeys = {
  all: ["graph"] as const,
  topology: () => [...graphKeys.all, "topology"] as const,
  blastRadius: (service: string) =>
    [...graphKeys.all, "blast-radius", service] as const,
  runbooks: (service: string) =>
    [...graphKeys.all, "runbooks", service] as const,
  incidents: (service?: string) =>
    [...graphKeys.all, "incidents", service ?? "all"] as const,
};

export const topologyQueryOptions = queryOptions({
  queryKey: graphKeys.topology(),
  queryFn: () => apiClient<TopologyResponse>("/api/graph/topology"),
  staleTime: 5 * 60 * 1000,
});

export function blastRadiusQueryOptions(service: string) {
  return queryOptions({
    queryKey: graphKeys.blastRadius(service),
    queryFn: () =>
      apiClient<BlastRadiusResponse>(`/api/graph/blast-radius/${service}`),
  });
}

export function runbooksQueryOptions(service: string) {
  return queryOptions({
    queryKey: graphKeys.runbooks(service),
    queryFn: () => apiClient<Runbook[]>(`/api/graph/runbooks/${service}`),
  });
}

export function incidentsQueryOptions(service?: string) {
  return queryOptions({
    queryKey: graphKeys.incidents(service),
    queryFn: () =>
      apiClient<Incident[]>("/api/graph/incidents", {
        params: service ? { service } : {},
      }),
  });
}
