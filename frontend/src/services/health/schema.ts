import { z } from "zod";

export const serviceStatusSchema = z.object({
  service: z.string(),
  status: z.enum(["healthy", "unhealthy", "unreachable"]),
});

export const healthResponseSchema = z.object({
  status: z.enum(["healthy", "degraded"]),
  services: z.record(
    z.string(),
    z.enum(["healthy", "unhealthy", "unreachable"]),
  ),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
