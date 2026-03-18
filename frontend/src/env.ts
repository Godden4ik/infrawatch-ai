import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_BACKEND_URL: z.string().url().default("http://localhost:8090"),
    PROMETHEUS_URL: z.string().url().default("http://localhost:9090"),
  },
  client: {
    NEXT_PUBLIC_MSW_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true"),
  },
  runtimeEnv: {
    API_BACKEND_URL: process.env.API_BACKEND_URL,
    PROMETHEUS_URL: process.env.PROMETHEUS_URL,
    NEXT_PUBLIC_MSW_ENABLED: process.env.NEXT_PUBLIC_MSW_ENABLED,
  },
});
