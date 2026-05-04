import { z } from "zod";

export const BenchmarkResultSchema = z.object({
  id: z.string(),
  name: z.string(),
  rca_correct: z.boolean(),
  blast_radius_recall: z.number(),
  blast_radius_precision: z.number(),
  runbook_recall: z.number(),
  confidence: z.number(),
  duration: z.number(),
});

export type BenchmarkResult = z.infer<typeof BenchmarkResultSchema>;

export const BenchmarkEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("log"),
    message: z.string(),
  }),
  z.object({
    type: z.literal("complete"),
    results: z.array(BenchmarkResultSchema),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);

export type BenchmarkEvent = z.infer<typeof BenchmarkEventSchema>;
