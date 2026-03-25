---
name: msw-mock
description: Generate MSW mock data and handlers for InfraWatch frontend services. Use when adding new API endpoints, extending mock coverage, or setting up development without backend services.
---

# MSW Mock Generation Skill

## When to Use
- Adding a new API endpoint to the frontend
- Extending existing mock coverage with new data
- Setting up offline frontend development
- Adding mock data for testing

## Quick Reference

### Running with MSW
```bash
cd frontend && pnpm dev:msw
# Opens at localhost:3001 with all API calls mocked
```

### File Structure
```
frontend/src/mocks/
├── browser.ts          # Browser worker (dev)
├── server.ts           # Node server (testing)
├── msw-init.tsx        # React lazy-load initializer
├── handlers.ts         # Central handler registry
├── data/               # Mock data factories
│   ├── health.ts       # Service health responses
│   ├── metrics.ts      # Prometheus metric generators
│   ├── graph.ts        # Neo4j topology, blast radius, runbooks, incidents
│   ├── pipeline.ts     # SSE streaming events for agent pipeline
│   ├── anomaly.ts      # Injection/reset responses
│   └── rag.ts          # GraphRAG vs Naive comparison data
└── handlers/           # MSW request handlers
    ├── health.ts
    ├── metrics.ts
    ├── graph.ts
    ├── pipeline.ts     # SSE streaming handler
    ├── anomaly.ts      # Mutates health state on inject/reset
    └── rag.ts
```

### Adding a New Mock

Use the `msw-mock` agent: it reads the service schema, generates both data and handler files, and registers them.

Or manually:

1. **Create data file** at `src/mocks/data/{name}.ts` — export mock data + getter functions
2. **Create handler file** at `src/mocks/handlers/{name}.ts` — export `{name}Handlers` array
3. **Register** in `src/mocks/handlers.ts` — import and spread into `handlers` array

### Handler Patterns

**GET with params:**
```typescript
http.get("*/api/path/:id", async ({ params, request }) => {
  console.log("[MSW] Intercepting:", request.url);
  await delay(300);
  return HttpResponse.json(getData(params.id as string));
})
```

**POST with body:**
```typescript
http.post("*/api/path", async ({ request }) => {
  await delay(500);
  const body = await request.json() as { field: string };
  return HttpResponse.json(processBody(body));
})
```

**SSE streaming:**
```typescript
http.post("*/api/stream", async () => {
  const stream = new ReadableStream({
    async start(controller) {
      for (const event of events) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        await new Promise(r => setTimeout(r, 30));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream" },
  });
})
```

### Cross-handler State

Handlers can share state (e.g., anomaly injection toggles health degraded mode):
```typescript
// handlers/health.ts exports setDegraded()
// handlers/anomaly.ts calls setDegraded(true/false)
```

### Testing Utilities

```typescript
import { mockApiResponse, mockApiError } from "@/testing";

// Override a handler for one test
mockApiResponse("get", "*/api/health/health", { status: "degraded", services: {} });
mockApiError("get", "*/api/health/health", 500);
```
