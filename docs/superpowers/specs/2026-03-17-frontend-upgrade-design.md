# InfraWatch Architecture Upgrade — Design Spec

**Date:** 2026-03-17
**Branch:** `feature/frontend-nextjs`
**Status:** Approved

## Overview

Upgrade InfraWatch from a Streamlit-only UI to a production-grade Next.js frontend, while modernizing Python developer experience, cleaning up monorepo packaging, and adding a dedicated API backend service.

## 1. Python Developer Experience

### Package Management: uv

Replace pip with `uv` for dependency management. Generates `uv.lock` for reproducible builds.

- Install: `brew install uv`
- Usage: `uv sync` replaces `pip install -e .`
- Lock file: `uv.lock` committed to git

### Linting & Formatting: ruff

Single tool replaces flake8, black, isort.

```toml
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]
```

### Type Checking: pyright

```toml
[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "basic"
```

## 2. Monorepo Cleanup

### Problem

Imports currently use `sys.path.insert(0, ...)` hacks in `ui/`, `scripts/`, and tests.

### Solution

Add proper package discovery to `pyproject.toml`:

```toml
[tool.setuptools.packages.find]
include = ["agents*", "graph*", "scripts*"]

[tool.setuptools.package-dir]
prometheus_mcp = "mcp-servers/prometheus_mcp"
grafana_mcp = "mcp-servers/grafana_mcp"
neo4j_mcp = "mcp-servers/neo4j_mcp"
```

Note: `mcp-servers/` directory keeps its hyphenated name (matches existing Docker/compose references). Individual sub-packages are mapped explicitly via `package-dir` since Python cannot import hyphenated directory names.

- Add `__init__.py` files where missing
- Remove all `sys.path.insert` hacks
- `uv pip install -e .` makes all packages importable
- Docker containers use `PYTHONPATH=/project` (unchanged)

### Package Map

```
agents/                       → import agents
graph/                        → import graph
mcp-servers/prometheus_mcp/   → import prometheus_mcp  (via package-dir)
mcp-servers/grafana_mcp/      → import grafana_mcp     (via package-dir)
mcp-servers/neo4j_mcp/        → import neo4j_mcp       (via package-dir)
```

## 3. API Backend Service

New FastAPI service at `api-backend/` (repo root, not inside `services/`) on port `8090`. Acts as the control plane — separates "the system being observed" (`services/` on 8080-8004) from "the system doing the observing." Keeping it at the repo root reinforces this boundary.

### Directory Structure

```
api-backend/
├── app.py              # FastAPI app, CORS, lifespan
├── routes/
│   ├── pipeline.py     # POST /pipeline/run (SSE streaming)
│   ├── graph.py        # GET /graph/topology, /graph/blast-radius/{service}
│   ├── anomaly.py      # POST /anomaly/inject, POST /anomaly/reset
│   ├── health.py       # GET /health (aggregated service checks)
│   └── rag.py          # POST /rag/evaluate
└── Dockerfile
```

Dependencies are managed via the root `pyproject.toml` (shared with the rest of the monorepo via uv). No separate `requirements.txt` — the Dockerfile runs `uv sync` against the root lockfile.

### Endpoints

| Method | Path | Description | Response |
|--------|------|-------------|----------|
| `POST` | `/pipeline/run` | Run Monitor, Analyst, Responder | SSE stream |
| `GET` | `/graph/topology` | Full service dependency graph | JSON nodes + edges |
| `GET` | `/graph/blast-radius/{service}` | Affected services | JSON list |
| `GET` | `/graph/runbooks/{service}` | Runbooks for a service | JSON list |
| `GET` | `/graph/incidents?service={name}` | Similar incidents for a service | JSON list |
| `POST` | `/anomaly/inject` | Inject anomaly on a service | 200 OK |
| `POST` | `/anomaly/reset` | Clear all anomalies | 200 OK |
| `GET` | `/health` | Aggregated status of all services | JSON status map |
| `POST` | `/rag/evaluate` | GraphRAG vs Naive RAG comparison | JSON scores |

### Key Implementation Details

- Pipeline streaming: `StreamingResponse` with `text/event-stream`, wraps existing `stream_pipeline()` from `agents/`
- Graph routes: Call Neo4j directly, reuses `graph/` package
- Anomaly routes: Proxy to simulated services' `/inject` endpoints
- Health route: Checks all 5 services + Prometheus + Neo4j
- No auth (local dev tool)
- Ollama support: `POST /pipeline/run` accepts `llm_provider` and `llm_model` in request body (defaults to `anthropic` / `claude-haiku-4-5-20251001`). `OLLAMA_BASE_URL` env var for Docker.
- CORS: Allow `http://localhost:3001` origin for local dev without Docker (not needed when proxied through Next.js route handlers)

## 4. Next.js Frontend

### Tech Stack

- Next.js 16 + React 19 + TypeScript
- shadcn/ui with base-ui components (`base-nova` style)
- TanStack Query v5 (server state, SSE streaming via cache updates)
- Zod (schema validation)
- nuqs (URL state management)
- recharts (metrics charts — lighter than Plotly)
- @xyflow/react (topology graph — proper React component, replaces pyvis)
- @t3-oss/env-nextjs (runtime env validation)

### Dependencies to Install

Already present: `next`, `react`, `react-dom`, `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `next-themes`

To add:
```
@tanstack/react-query  zod  nuqs  recharts  @xyflow/react  @t3-oss/env-nextjs  server-only
```

The `frontend/` directory is part of the monorepo (not a separate git repo). Any `.git` directory inside it should be removed.

### Directory Structure

```
frontend/
├── app/
│   ├── layout.tsx              # Root layout, providers, sidebar
│   ├── page.tsx                # Home — service status overview
│   ├── globals.css
│   ├── api/
│   │   ├── pipeline/[...path]/route.ts   → localhost:8090
│   │   ├── graph/[...path]/route.ts      → localhost:8090
│   │   ├── anomaly/[...path]/route.ts    → localhost:8090
│   │   ├── health/[...path]/route.ts     → localhost:8090
│   │   ├── rag/[...path]/route.ts        → localhost:8090
│   │   └── metrics/[...path]/route.ts    → localhost:9090
│   ├── dashboard/
│   │   ├── page.tsx            # Service Health — live metrics
│   │   └── _components/
│   ├── anomaly/
│   │   ├── page.tsx            # Anomaly Injection
│   │   └── _components/
│   ├── pipeline/
│   │   ├── page.tsx            # Pipeline Results — SSE streaming
│   │   └── _components/
│   ├── topology/
│   │   ├── page.tsx            # Dependency Graph — interactive viz
│   │   └── _components/
│   └── evaluation/
│       ├── page.tsx            # GraphRAG Eval — charts
│       └── _components/
├── components/
│   ├── ui/                     # shadcn/base-ui primitives
│   └── layout/
│       ├── sidebar.tsx
│       ├── header.tsx
│       └── status-indicator.tsx
├── services/
│   ├── _shared/
│   │   ├── fetch-client.ts     # apiClient (browser → /api/...)
│   │   ├── fetch-server.ts     # serverFetch (route handlers + server actions → Python)
│   │   ├── safe-action.ts      # safeAction wrapper (next-safe-action)
│   │   └── errors.ts
│   ├── pipeline/
│   │   ├── schema.ts           # Zod DTOs (agent result, stream event)
│   │   ├── api-schema.ts       # Request schemas
│   │   ├── query-options.ts    # TanStack Query key factories
│   │   └── use-pipeline.ts     # useMutation via proxy route (SSE), progressive cache update
│   ├── graph/
│   │   ├── schema.ts
│   │   └── query-options.ts
│   ├── metrics/
│   │   ├── schema.ts
│   │   └── query-options.ts
│   ├── anomaly/
│   │   ├── schema.ts
│   │   ├── actions.ts          # injectAnomaly, resetAnomalies
│   │   └── query-options.ts
│   └── rag/
│       ├── schema.ts
│       ├── actions.ts          # evaluateRag
│       └── query-options.ts
├── hooks/
├── lib/
│   ├── utils.ts                # cn() helper
│   └── query-client.ts         # TanStack Query config
├── providers/
│   └── providers.tsx           # QueryClientProvider, ThemeProvider
└── env.ts                      # @t3-oss/env-nextjs validation
```

### Data Flow Patterns

**Fetches (GET requests):**
```
Client component
  → useSuspenseQuery(queryOptions)
  → apiClient.get("/api/[service]/...")
  → /api/[service]/[...path]/route.ts
  → serverFetch(env.API_BACKEND_URL + path)
  → Python backend
```

**Mutations (POST/PUT/DELETE):**
```
Client component
  → useMutation({ mutationFn: async (req) => unwrap(await serverAction(req)) })
  → server action (actions.ts) wrapped in safeAction
  → serverFetch(env.API_BACKEND_URL + path)
  → Python backend
```

**Pipeline SSE streaming (exception to server action pattern):**

Server actions cannot stream responses. Pipeline streaming uses the proxy route directly:

```
Client component
  → useMutation triggers fetch to /api/pipeline/run (proxy route)
  → route.ts proxies SSE stream from api-backend via serverFetch
  → Client reads stream with response.body.getReader()
  → Progressive queryClient.setQueryData() updates per SSE event
  → Components re-render as events arrive
```

This is the one case where a mutation bypasses server actions — the proxy route.ts handles the server-side fetch, maintaining the "no direct browser-to-backend" rule.

### Pages

| Route | Page | Key Components |
|-------|------|----------------|
| `/` | Home | Service status cards, connectivity checks |
| `/dashboard` | Service Health | recharts line/area charts, auto-refresh, per-service metrics |
| `/anomaly` | Anomaly Injection | Preset scenario buttons, manual injection form |
| `/pipeline` | Pipeline Results | Live token streaming per agent, tool call display, progress |
| `/topology` | Dependency Graph | @xyflow/react interactive graph, blast-radius highlighting |
| `/evaluation` | GraphRAG Eval | Side-by-side comparison, recharts bar charts, score tables |

### Environment

```typescript
// frontend/env.ts
export const env = createEnv({
  server: {
    API_BACKEND_URL: z.string().url().default("http://localhost:8090"),
    PROMETHEUS_URL: z.string().url().default("http://localhost:9090"),
  },
  client: {},
  runtimeEnv: {
    API_BACKEND_URL: process.env.API_BACKEND_URL,
    PROMETHEUS_URL: process.env.PROMETHEUS_URL,
  },
});
```

All backend URLs are server-only. Never exposed to the browser.

Note: The metrics proxy (`/api/metrics/`) routes directly to Prometheus rather than through api-backend. This is intentional — PromQL queries are read-only and high-frequency; adding a pass-through would add latency with no benefit. The api-backend is the entry point for all stateful operations (pipeline, anomaly injection, graph queries).

## 5. Docker Integration

Add to `docker-compose.yml`:

```yaml
api-backend:
  build:
    context: .
    dockerfile: api-backend/Dockerfile
  ports: ["8090:8090"]
  environment:
    - NEO4J_URI=bolt://neo4j:7687
    - NEO4J_USER=neo4j
    - NEO4J_PASSWORD=infrawatch
    - PROMETHEUS_URL=http://prometheus:9090
    - GRAFANA_URL=http://grafana:3000
    - GRAFANA_USER=admin
    - GRAFANA_PASSWORD=infrawatch
    - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    - OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-}
  healthcheck:
    test: ["CMD", "curl", "-f", "http://localhost:8090/health"]
    interval: 10s
    timeout: 5s
    retries: 3
    start_period: 15s
  depends_on: [neo4j, prometheus, grafana]
  networks: [infrawatch]

frontend:
  build: frontend
  ports: ["3001:3000"]
  environment:
    - API_BACKEND_URL=http://api-backend:8090
    - PROMETHEUS_URL=http://prometheus:9090
  depends_on:
    api-backend:
      condition: service_healthy
    prometheus:
      condition: service_started
  networks: [infrawatch]
```

- Frontend on port `3001` (Grafana occupies `3000`)
- `api-backend` context is repo root (needs access to `agents/`, `graph/`)
- `api-backend` includes Grafana credentials (needed by MCP server during pipeline runs)
- Frontend waits for api-backend healthcheck before starting
- Existing Streamlit UI remains on `8501` during transition

## 6. Port Map (Updated)

| Service | Port |
|---------|------|
| api-gateway (simulated) | 8080 |
| payment-service | 8001 |
| user-service | 8002 |
| order-service | 8003 |
| redis-cache | 8004 |
| **api-backend (NEW)** | **8090** |
| Prometheus | 9090 |
| Grafana | 3000 |
| **Next.js frontend (NEW)** | **3001** |
| Neo4j HTTP | 7474 |
| Neo4j Bolt | 7687 |
| Streamlit UI (legacy) | 8501 |
