import { z } from "zod";

const metricsSchema = z.object({
  result_count: z.number(),
  context_richness: z.number(),
  services_found: z.array(z.string()),
  service_accuracy: z.number().optional(),
  llm_content_relevance: z.number().optional(),
  llm_actionability: z.number().optional(),
});

export const ragResultSchema = z.object({
  query: z.string(),
  judge_provider: z.string().optional(),
  judge_model: z.string().nullable().optional(),
  content_overlap: z.number().optional(),
  graphrag: z.object({
    runbook_results: z.array(z.record(z.string(), z.unknown())),
    incident_results: z.array(z.record(z.string(), z.unknown())),
    service_context: z.record(z.string(), z.unknown()).nullable().optional(),
    metrics: metricsSchema.optional(),
  }),
  naive: z.object({
    runbook_results: z.array(z.record(z.string(), z.unknown())),
    incident_results: z.array(z.record(z.string(), z.unknown())),
    metrics: metricsSchema.optional(),
  }),
});

export type RagResult = z.infer<typeof ragResultSchema>;
