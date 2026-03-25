import { http, HttpResponse, delay } from "msw";
import { getMockHealth } from "../data/health";

let degraded = false;

export const healthHandlers = [
  http.get("*/api/health/health", async ({ request }) => {
    console.log("[MSW] Intercepting health request:", request.url);
    await delay(300);
    return HttpResponse.json(getMockHealth(degraded));
  }),
];

/** Toggle degraded state — used by anomaly handlers */
export function setDegraded(value: boolean) {
  degraded = value;
}
