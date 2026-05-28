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
    /**
     * HMAC key used to sign demo-auth session tokens. REQUIRED when
     * DEMO_PASSWORD is set. Must be ≥32 chars of cryptographically random
     * input. Generate with: openssl rand -hex 32
     */
    SESSION_SECRET: z.string().min(32).optional(),
    /**
     * Public URLs surfaced by the header external-tool launchers. Read
     * server-side at request time and threaded through a Context so a
     * value change in .env applies on `docker compose up -d frontend`
     * — no rebuild needed (unlike NEXT_PUBLIC_* which is baked at build).
     */
    PUBLIC_GRAFANA_URL: z.string().url().default("http://localhost:3000"),
    PUBLIC_PROMETHEUS_URL: z.string().url().default("http://localhost:9090"),
    PUBLIC_NEO4J_URL: z.string().url().default("http://localhost:7474"),
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
    DEMO_PASSWORD: process.env.DEMO_PASSWORD,
    SESSION_SECRET: process.env.SESSION_SECRET,
    PUBLIC_GRAFANA_URL: process.env.PUBLIC_GRAFANA_URL,
    PUBLIC_PROMETHEUS_URL: process.env.PUBLIC_PROMETHEUS_URL,
    PUBLIC_NEO4J_URL: process.env.PUBLIC_NEO4J_URL,
    NEXT_PUBLIC_MSW_ENABLED: process.env.NEXT_PUBLIC_MSW_ENABLED,
  },
  emptyStringAsUndefined: true,
});
