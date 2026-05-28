import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    API_BACKEND_URL: z.string().url().default("http://localhost:8090"),
    PROMETHEUS_URL: z.string().url().default("http://localhost:9090"),
    /**
     * Optional shared-password gate. When set, middleware redirects all
     * requests without a matching `demo_auth` cookie to `/login`.
     * Leave unset (or empty) to disable auth entirely (local dev default).
     */
    DEMO_PASSWORD: z.string().optional(),
  },
  client: {
    NEXT_PUBLIC_MSW_ENABLED: z
      .string()
      .optional()
      .transform((v) => v === "true"),
    NEXT_PUBLIC_PROMETHEUS_URL: z
      .string()
      .url()
      .default("http://localhost:9090"),
    NEXT_PUBLIC_GRAFANA_URL: z.string().url().default("http://localhost:3000"),
    NEXT_PUBLIC_NEO4J_URL: z.string().url().default("http://localhost:7474"),
  },
  runtimeEnv: {
    API_BACKEND_URL: process.env.API_BACKEND_URL,
    PROMETHEUS_URL: process.env.PROMETHEUS_URL,
    DEMO_PASSWORD: process.env.DEMO_PASSWORD,
    NEXT_PUBLIC_MSW_ENABLED: process.env.NEXT_PUBLIC_MSW_ENABLED,
    NEXT_PUBLIC_PROMETHEUS_URL: process.env.NEXT_PUBLIC_PROMETHEUS_URL,
    NEXT_PUBLIC_GRAFANA_URL: process.env.NEXT_PUBLIC_GRAFANA_URL,
    NEXT_PUBLIC_NEO4J_URL: process.env.NEXT_PUBLIC_NEO4J_URL,
  },
  emptyStringAsUndefined: true,
});
