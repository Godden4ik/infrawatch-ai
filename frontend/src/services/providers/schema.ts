import { z } from "zod";

export const providerModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  param_size: z.string(),
});
export type ProviderModel = z.infer<typeof providerModelSchema>;

export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  available: z.boolean(),
  requires_key: z.boolean(),
  models: z.array(providerModelSchema),
  default_model: z.string(),
});
export type Provider = z.infer<typeof providerSchema>;

export const providersResponseSchema = z.object({
  providers: z.array(providerSchema),
});
export type ProvidersResponse = z.infer<typeof providersResponseSchema>;

export const healthResponseSchema = z.object({
  provider: z.string(),
  status: z.enum(["healthy", "unhealthy", "no_key"]),
  latency_ms: z.number(),
  checked_at: z.string(),
  error: z.string().optional(),
});
export type HealthResponse = z.infer<typeof healthResponseSchema>;
