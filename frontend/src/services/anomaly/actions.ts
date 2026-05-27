"use server";

import { serverFetch, apiBackendUrl } from "@/services/_shared/fetch-server";
import { safeAction } from "@/services/_shared/safe-action";
import {
  anomalyStatusResponseSchema,
  type AnomalyStatusResponse,
} from "./schema";

export async function injectAnomaly(service: string, anomalyType: string) {
  return safeAction(
    () =>
      serverFetch(apiBackendUrl, "/anomaly/inject", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service, anomaly_type: anomalyType }),
      }),
    { code: "ANOMALY_INJECT_FAILED", message: "Failed to inject anomaly" },
  );
}

export async function injectScenario(scenario: string) {
  return safeAction(
    () =>
      serverFetch(apiBackendUrl, `/anomaly/inject-scenario/${scenario}`, {
        method: "POST",
      }),
    { code: "SCENARIO_INJECT_FAILED", message: "Failed to inject scenario" },
  );
}

export async function getStatus() {
  return safeAction(
    async () => {
      const raw = await serverFetch<unknown>(apiBackendUrl, "/anomaly/status");
      return anomalyStatusResponseSchema.parse(raw) satisfies AnomalyStatusResponse;
    },
    { code: "ANOMALY_STATUS_FAILED", message: "Failed to load anomaly status" },
  );
}

export async function resetAnomalies() {
  return safeAction(
    () =>
      serverFetch(apiBackendUrl, "/anomaly/reset", {
        method: "POST",
      }),
    { code: "ANOMALY_RESET_FAILED", message: "Failed to reset anomalies" },
  );
}
