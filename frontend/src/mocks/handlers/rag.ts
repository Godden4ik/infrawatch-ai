import { http, HttpResponse, delay } from "msw";
import { getMockRagResult } from "../data/rag";

export const ragHandlers = [
  http.post("*/api/rag/evaluate", async ({ request }) => {
    console.log("[MSW] Intercepting RAG evaluate request:", request.url);
    await delay(1000);
    const body = (await request.json()) as { query: string };
    return HttpResponse.json(getMockRagResult(body.query));
  }),
];
