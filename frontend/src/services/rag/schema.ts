import { z } from "zod";

export const ragResultSchema = z.object({
  query: z.string(),
  graphrag: z.object({
    runbook_results: z.array(z.record(z.string(), z.unknown())),
    incident_results: z.array(z.record(z.string(), z.unknown())),
    service_context: z.record(z.string(), z.unknown()).nullable().optional(),
  }),
  naive: z.object({
    runbook_results: z.array(z.record(z.string(), z.unknown())),
    incident_results: z.array(z.record(z.string(), z.unknown())),
  }),
});

export type RagResult = z.infer<typeof ragResultSchema>;
