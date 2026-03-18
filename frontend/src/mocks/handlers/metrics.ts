import { http, HttpResponse, delay } from "msw";
import { generateMockPrometheusResponse } from "../data/metrics";

export const metricsHandlers = [
  http.get("*/api/metrics/api/v1/query", async ({ request }) => {
    console.log("[MSW] Intercepting Prometheus instant query:", request.url);
    await delay(200);
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";
    return HttpResponse.json(generateMockPrometheusResponse(query));
  }),

  http.get("*/api/metrics/api/v1/query_range", async ({ request }) => {
    console.log("[MSW] Intercepting Prometheus range query:", request.url);
    await delay(300);
    const url = new URL(request.url);
    const query = url.searchParams.get("query") ?? "";
    return HttpResponse.json(generateMockPrometheusResponse(query));
  }),
];
