import { z } from "zod";

export const ollamaModelSchema = z.object({
  name: z.string(),
  size: z.number(),
  parameter_size: z.string(),
  family: z.string(),
  quantization: z.string(),
});

export type OllamaModel = z.infer<typeof ollamaModelSchema>;

export const modelsResponseSchema = z.object({
  status: z.enum(["ok", "unavailable"]),
  models: z.array(ollamaModelSchema),
  error: z.string().optional(),
});

export type ModelsResponse = z.infer<typeof modelsResponseSchema>;

export function formatSize(bytes: number): string {
  if (bytes === 0) return "";
  const gb = bytes / 1_073_741_824;
  return gb >= 1 ? `${gb.toFixed(1)} GB` : `${(bytes / 1_048_576).toFixed(0)} MB`;
}
