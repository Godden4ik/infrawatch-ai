import { z } from "zod";

export const injectRequestSchema = z.object({
  service: z.string(),
  anomaly_type: z.string(),
});

export type InjectRequest = z.infer<typeof injectRequestSchema>;

export const ANOMALY_TYPES = [
  "latency",
  "error",
  "memory_leak",
  "cache_failure",
  "cache_degraded",
] as const;

export const SERVICES = [
  "api-gateway",
  "payment-service",
  "user-service",
  "order-service",
  "redis-cache",
] as const;

export const SCENARIOS = ["cascade"] as const;

export const serviceAnomalyStatusSchema = z.object({
  service: z.string(),
  anomaly_type: z.string().nullable(),
  since: z.string().nullable(),
});

export const anomalyStatusResponseSchema = z.object({
  services: z.array(serviceAnomalyStatusSchema),
});

export type ServiceAnomalyStatus = z.infer<typeof serviceAnomalyStatusSchema>;
export type AnomalyStatusResponse = z.infer<typeof anomalyStatusResponseSchema>;
