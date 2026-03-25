import { http, delay } from "msw";
import { generateMockPipelineEvents } from "../data/pipeline";

export const pipelineHandlers = [
  http.post("*/api/pipeline/run", async ({ request }) => {
    console.log("[MSW] Intercepting pipeline run request:", request.url);
    await delay(200);

    const events = generateMockPipelineEvents();
    const encoder = new TextEncoder();

    const stream = new ReadableStream({
      async start(controller) {
        for (const event of events) {
          const line = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
          // Simulate streaming delay — faster for tokens, slower for tool calls
          const delayMs = event.type === "token" ? 30 : 200;
          await new Promise((r) => setTimeout(r, delayMs));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }),
];
