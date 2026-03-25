import { http, HttpResponse, delay } from "msw";
import {
  mockTopology,
  getMockBlastRadius,
  getMockRunbooks,
  getMockIncidents,
} from "../data/graph";

export const graphHandlers = [
  http.get("*/api/graph/topology", async ({ request }) => {
    console.log("[MSW] Intercepting topology request:", request.url);
    await delay(400);
    return HttpResponse.json(mockTopology);
  }),

  http.get("*/api/graph/blast-radius/:service", async ({ params, request }) => {
    console.log("[MSW] Intercepting blast-radius request:", request.url);
    await delay(300);
    const service = params.service as string;
    return HttpResponse.json(getMockBlastRadius(service));
  }),

  http.get("*/api/graph/runbooks/:service", async ({ params, request }) => {
    console.log("[MSW] Intercepting runbooks request:", request.url);
    await delay(300);
    const service = params.service as string;
    return HttpResponse.json(getMockRunbooks(service));
  }),

  http.get("*/api/graph/incidents", async ({ request }) => {
    console.log("[MSW] Intercepting incidents request:", request.url);
    await delay(300);
    const url = new URL(request.url);
    const service = url.searchParams.get("service") ?? undefined;
    return HttpResponse.json(getMockIncidents(service));
  }),
];
