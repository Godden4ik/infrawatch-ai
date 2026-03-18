import { http, HttpResponse, delay } from "msw";
import {
  getMockInjectResponse,
  getMockScenarioResponse,
  getMockResetResponse,
} from "../data/anomaly";
import { setDegraded } from "./health";

export const anomalyHandlers = [
  http.post("*/api/anomaly/inject", async ({ request }) => {
    console.log("[MSW] Intercepting anomaly inject request:", request.url);
    await delay(500);
    const body = (await request.json()) as { service: string; anomaly_type: string };
    setDegraded(true);
    return HttpResponse.json(getMockInjectResponse(body.service, body.anomaly_type));
  }),

  http.post("*/api/anomaly/inject-scenario/:scenario", async ({ params, request }) => {
    console.log("[MSW] Intercepting scenario inject request:", request.url);
    await delay(800);
    const scenario = params.scenario as string;
    setDegraded(true);
    return HttpResponse.json(getMockScenarioResponse(scenario));
  }),

  http.post("*/api/anomaly/reset", async ({ request }) => {
    console.log("[MSW] Intercepting anomaly reset request:", request.url);
    await delay(500);
    setDegraded(false);
    return HttpResponse.json(getMockResetResponse());
  }),
];
