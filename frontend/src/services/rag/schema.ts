import { z } from "zod";

const graphragChunkSchema = z.object({
  chunk_id: z.string(),
  chunk_index: z.number(),
  content: z.string(),
  document_id: z.string(),
  document_title: z.string(),
  source_system: z.string(),
  related_services: z.array(z.string()),
  score: z.number(),
});

const naiveChunkSchema = z.object({
  chunk_id: z.string(),
  content: z.string(),
  document_title: z.string(),
  score: z.number(),
});

export type GraphragChunk = z.infer<typeof graphragChunkSchema>;
export type NaiveChunk = z.infer<typeof naiveChunkSchema>;

export const ragResultSchema = z.object({
  query: z.string(),
  graphrag: z.object({
    runbook_results: z.array(z.record(z.string(), z.unknown())),
    incident_results: z.array(z.record(z.string(), z.unknown())),
    service_context: z.record(z.string(), z.unknown()).nullable().optional(),
    chunk_results: z.array(graphragChunkSchema).optional(),
  }),
  naive: z.object({
    runbook_results: z.array(z.record(z.string(), z.unknown())),
    incident_results: z.array(z.record(z.string(), z.unknown())),
    chunk_results: z.array(naiveChunkSchema).optional(),
  }),
});

export type RagResult = z.infer<typeof ragResultSchema>;
