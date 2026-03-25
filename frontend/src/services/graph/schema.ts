import { z } from "zod";

export const topologyNodeSchema = z.object({
  name: z.string(),
  type: z.string().nullable(),
  labels: z.array(z.string()),
});

export const topologyEdgeSchema = z.object({
  source: z.string(),
  relationship: z.string(),
  target: z.string(),
});

export const topologyResponseSchema = z.object({
  nodes: z.array(topologyNodeSchema),
  edges: z.array(topologyEdgeSchema),
});

export const blastRadiusResponseSchema = z.object({
  service: z.string(),
  affected_services: z.array(z.string()),
});

export const runbookSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.string(),
  steps: z.array(z.string()),
});

export const incidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.string(),
  resolution: z.string().nullable(),
  timestamp: z.string().nullable(),
});

export type TopologyResponse = z.infer<typeof topologyResponseSchema>;
export type BlastRadiusResponse = z.infer<typeof blastRadiusResponseSchema>;
export type Runbook = z.infer<typeof runbookSchema>;
export type Incident = z.infer<typeof incidentSchema>;
