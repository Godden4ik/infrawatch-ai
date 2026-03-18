# InfraWatch Architecture Upgrade Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize InfraWatch with proper Python packaging (uv + ruff), a dedicated API backend, and a production-grade Next.js frontend replacing Streamlit.

**Architecture:** Five sequential phases: (1) Python DX tooling, (2) monorepo packaging cleanup, (3) FastAPI API backend, (4) Next.js frontend infrastructure + services layer, (5) frontend pages + Docker integration.

**Tech Stack:** Python 3.12, uv, ruff, pyright, FastAPI, Next.js 16, React 19, shadcn/base-ui, TanStack Query, Zod, recharts, @xyflow/react

**Spec:** `docs/superpowers/specs/2026-03-17-frontend-upgrade-design.md`

---

## Phase 1: Python Developer Experience

### Task 1: Install uv and initialize lockfile

**Files:**
- Modify: `pyproject.toml`
- Create: `uv.lock` (generated)
- Modify: `.gitignore`

- [ ] **Step 1: Install uv**

```bash
brew install uv
```

- [ ] **Step 2: Add ruff and pyright config to pyproject.toml**

Add to `pyproject.toml`:

```toml
[tool.ruff]
target-version = "py312"
line-length = 100

[tool.ruff.lint]
select = ["E", "F", "I", "UP"]

[tool.pyright]
pythonVersion = "3.12"
typeCheckingMode = "basic"
```

- [ ] **Step 3: Add ruff and pyright to dev dependencies**

Add to `[dependency-groups] dev`:

```toml
dev = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
    "ruff>=0.12",
    "pyright>=1.1",
]
```

- [ ] **Step 4: Generate lockfile with uv**

```bash
uv sync
```

Expected: Creates `uv.lock` and `.venv/` directory.

- [ ] **Step 5: Verify ruff and pyright work**

```bash
uv run ruff check agents/ graph/
uv run pyright agents/ graph/
```

Expected: May show existing issues — that's fine. Tools should run without crashing.

- [ ] **Step 6: Add .venv/ to .gitignore**

Append `.venv/` to `.gitignore` if not already present.

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml uv.lock .gitignore
git commit -m "feat: add uv, ruff, and pyright for Python DX"
```

---

## Phase 2: Monorepo Packaging Cleanup

### Task 2: Fix package discovery and remove sys.path hacks

**Files:**
- Modify: `pyproject.toml`
- Create: `scripts/__init__.py`
- Modify: `scripts/evaluate_rag.py:25` — remove sys.path.insert
- Modify: `scripts/inject_anomaly.py` — no sys.path here, skip
- Modify: `tests/unit/test_graphrag.py:9` — remove sys.path.insert
- Modify: `tests/unit/test_ingest.py:11` — remove sys.path.insert
- Modify: `tests/unit/test_anomaly_script.py:7` — remove sys.path.insert
- Modify: `tests/integration/test_graphrag.py:12` — remove sys.path.insert
- Modify: `tests/e2e/test_graphrag_scenarios.py:15` — remove sys.path.insert
- Modify: `ui/components/pipeline.py:10-12` — remove sys.path.insert
- Modify: `ui/pages/1_Dashboard.py:9` — remove sys.path.insert
- Modify: `ui/pages/2_Anomaly_Injection.py:11` — remove sys.path.insert
- Modify: `ui/pages/3_Pipeline_Results.py:8` — remove sys.path.insert
- Modify: `ui/pages/4_Dependency_Graph.py:8` — remove sys.path.insert
- Modify: `ui/pages/5_GraphRAG_Eval.py:11-13` — remove sys.path.insert

- [ ] **Step 1: Add package-dir and package discovery to pyproject.toml**

Add to `pyproject.toml`:

```toml
[tool.setuptools.packages.find]
include = ["agents*", "graph*", "scripts*"]

[tool.setuptools.package-dir]
prometheus_mcp = "mcp-servers/prometheus_mcp"
grafana_mcp = "mcp-servers/grafana_mcp"
neo4j_mcp = "mcp-servers/neo4j_mcp"
api_backend = "api-backend"
"api_backend.routes" = "api-backend/routes"
```

- [ ] **Step 2: Create missing __init__.py**

```bash
touch scripts/__init__.py
```

- [ ] **Step 3: Re-sync uv to install packages in editable mode**

```bash
uv sync
```

- [ ] **Step 4: Verify imports work without sys.path hacks**

```bash
uv run python -c "from agents import run_pipeline; print('agents OK')"
uv run python -c "from graph.retrieval import graphrag_retrieve; print('graph OK')"
uv run python -c "from prometheus_mcp.server import mcp; print('prometheus_mcp OK')"
```

Expected: All print OK without errors.

- [ ] **Step 5: Remove sys.path.insert from all 12 files**

Remove the `sys.path.insert(0, ...)` line (and related `os.path` setup lines) from each of these files:

1. `scripts/evaluate_rag.py` — line 25
2. `tests/unit/test_graphrag.py` — line 9
3. `tests/unit/test_ingest.py` — line 11
4. `tests/unit/test_anomaly_script.py` — line 7
5. `tests/integration/test_graphrag.py` — line 12
6. `tests/e2e/test_graphrag_scenarios.py` — line 15
7. `ui/components/pipeline.py` — lines 10-12
8. `ui/pages/1_Dashboard.py` — line 9
9. `ui/pages/2_Anomaly_Injection.py` — line 11
10. `ui/pages/3_Pipeline_Results.py` — line 8
11. `ui/pages/4_Dependency_Graph.py` — line 8
12. `ui/pages/5_GraphRAG_Eval.py` — lines 11-13

Also remove the related `import os, sys` lines if they become unused after removal.

- [ ] **Step 6: Run unit tests to verify nothing broke**

```bash
uv run pytest tests/unit/ -v
```

Expected: All unit tests pass.

- [ ] **Step 7: Commit**

```bash
git add pyproject.toml scripts/__init__.py scripts/ tests/ ui/
git commit -m "refactor: proper package discovery, remove sys.path hacks"
```

---

## Phase 3: API Backend Service

### Task 3: Create FastAPI api-backend skeleton

**Files:**
- Create: `api-backend/__init__.py`
- Create: `api-backend/app.py`
- Create: `api-backend/routes/__init__.py`
- Create: `api-backend/routes/health.py`
- Create: `api-backend/Dockerfile`

- [ ] **Step 1: Create api-backend directory structure**

```bash
mkdir -p api-backend/routes
touch api-backend/__init__.py api-backend/routes/__init__.py
```

- [ ] **Step 2: Write api-backend/app.py**

```python
"""InfraWatch API Backend — control plane for the monitoring system."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_backend.routes import health, pipeline, graph, anomaly, rag


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="InfraWatch API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3001"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
app.include_router(graph.router, prefix="/graph", tags=["graph"])
app.include_router(anomaly.router, prefix="/anomaly", tags=["anomaly"])
app.include_router(rag.router, prefix="/rag", tags=["rag"])
```

Note: Initially only health route will exist. Other router imports will be added as routes are created in subsequent tasks. Start with just:

```python
from api_backend.routes import health
# other routers added in tasks 4-7
```

And only `app.include_router(health.router, tags=["health"])`.

- [ ] **Step 3: Write api-backend/routes/health.py**

```python
"""Aggregated health check for all InfraWatch services."""

import asyncio

import httpx
from fastapi import APIRouter

router = APIRouter()

def _service_host() -> str:
    """In Docker, services resolve by name. Locally, use localhost."""
    return os.getenv("SERVICE_HOST", "localhost")


def _get_service_urls() -> dict[str, str]:
    host = _service_host()
    return {
        "api-gateway": f"http://{host}:8080",
        "payment-service": f"http://{host}:8001",
        "user-service": f"http://{host}:8002",
        "order-service": f"http://{host}:8003",
        "redis-cache": f"http://{host}:8004",
        "prometheus": os.getenv("PROMETHEUS_URL", f"http://{host}:9090") + "/-/ready",
        "neo4j": f"http://{host}:7474",
    }


async def _check(client: httpx.AsyncClient, name: str, url: str) -> dict:
    try:
        r = await client.get(url, timeout=3.0)
        return {"service": name, "status": "healthy" if r.status_code < 400 else "unhealthy"}
    except Exception:
        return {"service": name, "status": "unreachable"}


@router.get("/health")
async def health():
    async with httpx.AsyncClient() as client:
        urls = _get_service_urls()
        results = await asyncio.gather(
            *[_check(client, name, url) for name, url in urls.items()]
        )
    status_map = {r["service"]: r["status"] for r in results}
    all_healthy = all(s == "healthy" for s in status_map.values())
    return {"status": "healthy" if all_healthy else "degraded", "services": status_map}
```

- [ ] **Step 4: Write api-backend/Dockerfile**

```dockerfile
FROM python:3.12-slim

WORKDIR /project

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first for caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy source
COPY agents/ agents/
COPY graph/ graph/
COPY mcp-servers/ mcp-servers/
COPY api-backend/ api-backend/

ENV PYTHONPATH=/project

EXPOSE 8090

CMD ["uv", "run", "uvicorn", "api_backend.app:app", "--host", "0.0.0.0", "--port", "8090"]
```

- [ ] **Step 5: Test health endpoint locally**

```bash
uv run uvicorn api_backend.app:app --port 8090 &
sleep 2
curl http://localhost:8090/health
kill %1
```

Expected: JSON with service statuses (services may be unreachable if Docker isn't running — that's fine, the endpoint itself should respond).

- [ ] **Step 6: Commit**

```bash
git add api-backend/
git commit -m "feat: add api-backend skeleton with health endpoint"
```

### Task 4: Add pipeline route (SSE streaming)

**Files:**
- Create: `api-backend/routes/pipeline.py`
- Modify: `api-backend/app.py` — add pipeline router import

- [ ] **Step 1: Write api-backend/routes/pipeline.py**

```python
"""Pipeline execution with SSE streaming."""

import json
from typing import AsyncGenerator

from fastapi import APIRouter
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from agents import stream_pipeline

router = APIRouter()


class PipelineRequest(BaseModel):
    llm_provider: str = "anthropic"
    llm_model: str | None = None


async def _stream_events(req: PipelineRequest) -> AsyncGenerator[str, None]:
    async for event in stream_pipeline(
        verbose=False,
        llm_provider=req.llm_provider,
        llm_model=req.llm_model,
    ):
        event_type = event.get("event", "unknown")
        name = event.get("name", "")
        data = {}

        if event_type == "on_chat_model_stream":
            chunk = event.get("data", {}).get("chunk")
            if chunk and hasattr(chunk, "content") and chunk.content:
                data = {"type": "token", "agent": name, "content": chunk.content}
        elif event_type == "on_tool_start":
            data = {
                "type": "tool_start",
                "agent": name,
                "tool": event.get("data", {}).get("input", {}).get("name", ""),
            }
        elif event_type == "on_tool_end":
            output = event.get("data", {}).get("output", "")
            if isinstance(output, str) and len(output) > 500:
                output = output[:500] + "..."
            data = {"type": "tool_end", "agent": name, "output": output}
        elif event_type == "on_chain_end" and name in (
            "monitor_node",
            "analyst_node",
            "responder_node",
        ):
            result = event.get("data", {}).get("output", {})
            data = {"type": "agent_complete", "agent": name, "result": result}
        else:
            continue

        yield f"data: {json.dumps(data)}\n\n"

    yield "data: {\"type\": \"done\"}\n\n"


@router.post("/run")
async def run_pipeline_endpoint(req: PipelineRequest = PipelineRequest()):
    return StreamingResponse(
        _stream_events(req),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 2: Add pipeline router to app.py**

Add import and include_router for pipeline to `api-backend/app.py`.

- [ ] **Step 3: Commit**

```bash
git add api-backend/
git commit -m "feat: add pipeline SSE streaming endpoint"
```

### Task 5: Add graph routes

**Files:**
- Create: `api-backend/routes/graph.py`
- Modify: `api-backend/app.py` — add graph router import

- [ ] **Step 1: Write api-backend/routes/graph.py**

```python
"""Neo4j graph topology and knowledge base routes."""

import os

from fastapi import APIRouter, Query
from neo4j import AsyncGraphDatabase

router = APIRouter()

NEO4J_URI = os.getenv("NEO4J_URI", "bolt://localhost:7687")
NEO4J_USER = os.getenv("NEO4J_USER", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "infrawatch")


async def _run_query(query: str, params: dict | None = None) -> list[dict]:
    driver = AsyncGraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USER, NEO4J_PASSWORD))
    try:
        async with driver.session() as session:
            result = await session.run(query, params or {})
            return [dict(record) for record in await result.data()]
    finally:
        await driver.close()


@router.get("/topology")
async def get_topology():
    nodes_query = "MATCH (s:Service) RETURN s.name AS name, s.type AS type, labels(s) AS labels"
    edges_query = """
        MATCH (a:Service)-[r]->(b:Service)
        RETURN a.name AS source, type(r) AS relationship, b.name AS target
    """
    nodes = await _run_query(nodes_query)
    edges = await _run_query(edges_query)
    return {"nodes": nodes, "edges": edges}


@router.get("/blast-radius/{service}")
async def get_blast_radius(service: str):
    query = """
        MATCH (s:Service {name: $service})
        OPTIONAL MATCH (s)<-[:CALLS|ROUTES_TO|DEPENDS_ON*1..3]-(affected:Service)
        RETURN COLLECT(DISTINCT affected.name) AS affected_services
    """
    result = await _run_query(query, {"service": service})
    affected = result[0]["affected_services"] if result else []
    return {"service": service, "affected_services": affected}


@router.get("/runbooks/{service}")
async def get_runbooks(service: str):
    query = """
        MATCH (r:Runbook)-[:APPLIES_TO]->(s:Service {name: $service})
        OPTIONAL MATCH (r)-[:HAS_STEP]->(step:RunbookStep)
        RETURN r.id AS id, r.title AS title, r.severity AS severity,
               COLLECT(step.description) AS steps
        ORDER BY r.severity
    """
    return await _run_query(query, {"service": service})


@router.get("/incidents")
async def get_incidents(service: str = Query(None)):
    if service:
        query = """
            MATCH (i:Incident)-[:AFFECTED|ROOT_CAUSE_IN]->(s:Service {name: $service})
            RETURN i.id AS id, i.title AS title, i.severity AS severity,
                   i.resolution AS resolution, i.timestamp AS timestamp
            ORDER BY i.timestamp DESC
        """
        return await _run_query(query, {"service": service})
    else:
        query = """
            MATCH (i:Incident)
            RETURN i.id AS id, i.title AS title, i.severity AS severity,
                   i.resolution AS resolution, i.timestamp AS timestamp
            ORDER BY i.timestamp DESC LIMIT 20
        """
        return await _run_query(query)
```

- [ ] **Step 2: Add graph router to app.py**

Add import and include_router for graph to `api-backend/app.py`.

- [ ] **Step 3: Commit**

```bash
git add api-backend/
git commit -m "feat: add graph topology and knowledge base routes"
```

### Task 6: Add anomaly routes

**Files:**
- Create: `api-backend/routes/anomaly.py`
- Modify: `api-backend/app.py` — add anomaly router import

- [ ] **Step 1: Write api-backend/routes/anomaly.py**

```python
"""Anomaly injection and reset routes."""

import asyncio

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

SERVICE_PORTS = {
    "api-gateway": 8080,
    "payment-service": 8001,
    "user-service": 8002,
    "order-service": 8003,
    "redis-cache": 8004,
}

SCENARIOS = {
    "cascade": [
        ("redis-cache", "cache_failure"),
        ("payment-service", "cache_degraded"),
        ("order-service", "cache_degraded"),
    ],
}


class InjectRequest(BaseModel):
    service: str
    anomaly_type: str


@router.post("/inject")
async def inject_anomaly(req: InjectRequest):
    port = SERVICE_PORTS.get(req.service)
    if not port:
        return {"error": f"Unknown service: {req.service}"}
    async with httpx.AsyncClient() as client:
        r = await client.post(
            f"http://localhost:{port}/inject",
            params={"anomaly_type": req.anomaly_type},
            timeout=5.0,
        )
        return r.json()


@router.post("/inject-scenario/{scenario}")
async def inject_scenario(scenario: str):
    injections = SCENARIOS.get(scenario)
    if not injections:
        return {"error": f"Unknown scenario: {scenario}"}
    async with httpx.AsyncClient() as client:
        tasks = [
            client.post(
                f"http://localhost:{SERVICE_PORTS[svc]}/inject",
                params={"anomaly_type": atype},
                timeout=5.0,
            )
            for svc, atype in injections
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    return {
        "scenario": scenario,
        "results": [
            r.json() if not isinstance(r, Exception) else str(r) for r in results
        ],
    }


@router.post("/reset")
async def reset_anomalies():
    async with httpx.AsyncClient() as client:
        tasks = [
            client.post(
                f"http://localhost:{port}/inject",
                params={"anomaly_type": "none"},
                timeout=5.0,
            )
            for port in SERVICE_PORTS.values()
        ]
        await asyncio.gather(*tasks, return_exceptions=True)
    return {"status": "reset"}
```

- [ ] **Step 2: Add anomaly router to app.py**

Add import and include_router for anomaly to `api-backend/app.py`.

- [ ] **Step 3: Commit**

```bash
git add api-backend/
git commit -m "feat: add anomaly injection and reset routes"
```

### Task 7: Add RAG evaluation route

**Files:**
- Create: `api-backend/routes/rag.py`
- Modify: `api-backend/app.py` — add rag router import

- [ ] **Step 1: Write api-backend/routes/rag.py**

```python
"""GraphRAG vs Naive RAG evaluation endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel

from graph.retrieval import graphrag_retrieve, naive_rag_retrieve

router = APIRouter()


class EvalRequest(BaseModel):
    query: str
    service_context: str | None = None
    top_k: int = 5


@router.post("/evaluate")
async def evaluate_rag(req: EvalRequest):
    graphrag_results = await graphrag_retrieve(
        query=req.query,
        service_context=req.service_context,
        top_k=req.top_k,
    )
    naive_results = await naive_rag_retrieve(
        query=req.query,
        top_k=req.top_k,
    )
    return {
        "query": req.query,
        "graphrag": graphrag_results,
        "naive": naive_results,
    }
```

- [ ] **Step 2: Add rag router to app.py (final router)**

Now `api-backend/app.py` should import all 5 routers: health, pipeline, graph, anomaly, rag.

- [ ] **Step 3: Commit**

```bash
git add api-backend/
git commit -m "feat: add RAG evaluation endpoint"
```

---

## Phase 4: Next.js Frontend Infrastructure

### Task 8: Install frontend dependencies

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/pnpm-lock.yaml` (generated)

- [ ] **Step 1: Install core dependencies**

```bash
cd frontend
pnpm add @tanstack/react-query zod nuqs recharts @xyflow/react @t3-oss/env-nextjs server-only
```

- [ ] **Step 2: Verify build still works**

```bash
pnpm build
```

Expected: Build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "feat: install frontend core dependencies"
```

### Task 9: Set up environment validation

**Files:**
- Create: `frontend/env.ts`

- [ ] **Step 1: Write frontend/env.ts**

```typescript
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

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

- [ ] **Step 2: Commit**

```bash
git add frontend/env.ts
git commit -m "feat: add runtime environment validation"
```

### Task 10: Set up services layer (shared fetch utilities)

**Files:**
- Create: `frontend/services/_shared/fetch-server.ts`
- Create: `frontend/services/_shared/fetch-client.ts`
- Create: `frontend/services/_shared/errors.ts`
- Create: `frontend/services/_shared/safe-action.ts`

- [ ] **Step 1: Write frontend/services/_shared/errors.ts**

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
```

- [ ] **Step 2: Write frontend/services/_shared/fetch-server.ts**

```typescript
import "server-only";
import { env } from "@/env";
import { ApiError } from "./errors";

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

export async function serverFetch<T>(
  baseUrl: string,
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, ...init } = options;
  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    ...init,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, "FETCH_FAILED", body);
  }

  return res.json();
}

export async function serverFetchStream(
  baseUrl: string,
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { params, ...init } = options;
  const url = new URL(path, baseUrl);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), {
    ...init,
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, "STREAM_FAILED", body);
  }

  return res;
}

export const apiBackendUrl = env.API_BACKEND_URL;
export const prometheusUrl = env.PROMETHEUS_URL;
```

- [ ] **Step 3: Write frontend/services/_shared/fetch-client.ts**

```typescript
import { ApiError } from "./errors";

type FetchOptions = RequestInit & {
  params?: Record<string, string>;
};

export async function apiClient<T>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { params, ...init } = options;
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, "CLIENT_FETCH_FAILED", body);
  }

  return res.json();
}

export async function apiClientStream(
  path: string,
  options: FetchOptions = {},
): Promise<Response> {
  const { params, ...init } = options;
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }

  const res = await fetch(url.toString(), init);

  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, "STREAM_FAILED", body);
  }

  return res;
}
```

- [ ] **Step 4: Write frontend/services/_shared/safe-action.ts**

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export async function safeAction<T>(
  fn: () => Promise<T>,
  errorInfo: { code: string; message: string },
): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { success: true, data };
  } catch (error) {
    console.error(`[${errorInfo.code}]`, error);
    return { success: false, error: errorInfo };
  }
}

export function unwrap<T>(result: ActionResult<T>): T {
  if (!result.success) {
    throw new Error(`${result.error.code}: ${result.error.message}`);
  }
  return result.data;
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/services/
git commit -m "feat: add shared fetch utilities and safe-action pattern"
```

### Task 11: Set up proxy route handlers

**Files:**
- Create: `frontend/app/api/pipeline/[...path]/route.ts`
- Create: `frontend/app/api/graph/[...path]/route.ts`
- Create: `frontend/app/api/anomaly/[...path]/route.ts`
- Create: `frontend/app/api/health/[...path]/route.ts`
- Create: `frontend/app/api/rag/[...path]/route.ts`
- Create: `frontend/app/api/metrics/[...path]/route.ts`

- [ ] **Step 1: Create a shared proxy helper**

Create `frontend/app/api/_proxy.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { apiBackendUrl, prometheusUrl } from "@/services/_shared/fetch-server";

export function createProxy(baseUrl: string) {
  async function handler(
    req: NextRequest,
    { params }: { params: Promise<{ path: string[] }> },
  ) {
    const { path } = await params;
    const targetPath = "/" + path.join("/");
    const url = new URL(targetPath, baseUrl);
    req.nextUrl.searchParams.forEach((v, k) => url.searchParams.set(k, v));

    const headers = new Headers();
    headers.set("Content-Type", req.headers.get("Content-Type") || "application/json");

    const init: RequestInit = {
      method: req.method,
      headers,
      cache: "no-store",
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      init.body = await req.text();
    }

    const upstream = await fetch(url.toString(), init);

    // Stream SSE responses directly
    if (upstream.headers.get("content-type")?.includes("text/event-stream")) {
      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    }

    const body = await upstream.text();
    return new NextResponse(body, {
      status: upstream.status,
      headers: { "Content-Type": upstream.headers.get("Content-Type") || "application/json" },
    });
  }

  return {
    GET: handler,
    POST: handler,
    PUT: handler,
    DELETE: handler,
  };
}

export const backendProxy = createProxy(apiBackendUrl);
export const prometheusProxy = createProxy(prometheusUrl);
```

- [ ] **Step 2: Create proxy route files**

Each file is 2 lines. Create all 6:

`frontend/app/api/pipeline/[...path]/route.ts`:
```typescript
import { backendProxy } from "../../_proxy";
export const { GET, POST, PUT, DELETE } = backendProxy;
```

`frontend/app/api/graph/[...path]/route.ts`:
```typescript
import { backendProxy } from "../../_proxy";
export const { GET, POST, PUT, DELETE } = backendProxy;
```

`frontend/app/api/anomaly/[...path]/route.ts`:
```typescript
import { backendProxy } from "../../_proxy";
export const { GET, POST, PUT, DELETE } = backendProxy;
```

`frontend/app/api/health/[...path]/route.ts`:
```typescript
import { backendProxy } from "../../_proxy";
export const { GET, POST, PUT, DELETE } = backendProxy;
```

`frontend/app/api/rag/[...path]/route.ts`:
```typescript
import { backendProxy } from "../../_proxy";
export const { GET, POST, PUT, DELETE } = backendProxy;
```

`frontend/app/api/metrics/[...path]/route.ts`:
```typescript
import { prometheusProxy } from "../../_proxy";
export const { GET, POST, PUT, DELETE } = prometheusProxy;
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/api/
git commit -m "feat: add proxy route handlers for all backend services"
```

### Task 12: Set up TanStack Query provider

**Files:**
- Create: `frontend/lib/query-client.ts`
- Create: `frontend/providers/providers.tsx`
- Modify: `frontend/app/layout.tsx` — wrap in Providers

- [ ] **Step 1: Write frontend/lib/query-client.ts**

```typescript
import { QueryClient } from "@tanstack/react-query";

export function getQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchOnWindowFocus: false,
      },
    },
  });
}
```

- [ ] **Step 2: Write frontend/providers/providers.tsx**

```typescript
"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { getQueryClient } from "@/lib/query-client";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => getQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider
        attribute="class"
        defaultTheme="dark"
        enableSystem
        disableTransitionOnChange
      >
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Update frontend/app/layout.tsx to use Providers**

Replace the ThemeProvider wrapper in layout.tsx with the Providers component:

```tsx
import { Providers } from "@/providers/providers";

// In the return:
<body>
  <Providers>{children}</Providers>
</body>
```

Remove the direct ThemeProvider import from layout.tsx.

- [ ] **Step 4: Verify build**

```bash
cd frontend && pnpm build
```

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/query-client.ts frontend/providers/ frontend/app/layout.tsx
git commit -m "feat: add TanStack Query provider and app layout"
```

### Task 13: Create service-layer schemas and query options

**Files:**
- Create: `frontend/services/health/schema.ts`
- Create: `frontend/services/health/query-options.ts`
- Create: `frontend/services/metrics/schema.ts`
- Create: `frontend/services/metrics/query-options.ts`
- Create: `frontend/services/graph/schema.ts`
- Create: `frontend/services/graph/query-options.ts`
- Create: `frontend/services/pipeline/schema.ts`
- Create: `frontend/services/pipeline/query-options.ts`
- Create: `frontend/services/pipeline/use-pipeline.ts`
- Create: `frontend/services/anomaly/schema.ts`
- Create: `frontend/services/anomaly/actions.ts`
- Create: `frontend/services/anomaly/query-options.ts`
- Create: `frontend/services/rag/schema.ts`
- Create: `frontend/services/rag/actions.ts`
- Create: `frontend/services/rag/query-options.ts`

- [ ] **Step 1: Write health schemas and query options**

`frontend/services/health/schema.ts`:
```typescript
import { z } from "zod";

export const serviceStatusSchema = z.object({
  service: z.string(),
  status: z.enum(["healthy", "unhealthy", "unreachable"]),
});

export const healthResponseSchema = z.object({
  status: z.enum(["healthy", "degraded"]),
  services: z.record(z.string(), z.enum(["healthy", "unhealthy", "unreachable"])),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

`frontend/services/health/query-options.ts`:
```typescript
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import type { HealthResponse } from "./schema";

export const healthKeys = {
  all: ["health"] as const,
  status: () => [...healthKeys.all, "status"] as const,
};

export const healthQueryOptions = queryOptions({
  queryKey: healthKeys.status(),
  queryFn: () => apiClient<HealthResponse>("/api/health/health"),
  refetchInterval: 30_000,
});
```

- [ ] **Step 2: Write metrics schemas and query options**

`frontend/services/metrics/schema.ts`:
```typescript
import { z } from "zod";

export const prometheusResultSchema = z.object({
  status: z.string(),
  data: z.object({
    resultType: z.string(),
    result: z.array(
      z.object({
        metric: z.record(z.string()),
        values: z.array(z.tuple([z.number(), z.string()])).optional(),
        value: z.tuple([z.number(), z.string()]).optional(),
      }),
    ),
  }),
});

export type PrometheusResult = z.infer<typeof prometheusResultSchema>;
```

`frontend/services/metrics/query-options.ts`:
```typescript
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import type { PrometheusResult } from "./schema";

export const metricsKeys = {
  all: ["metrics"] as const,
  query: (promql: string) => [...metricsKeys.all, "query", promql] as const,
  range: (promql: string, start: string, end: string, step: string) =>
    [...metricsKeys.all, "range", promql, start, end, step] as const,
};

export function metricsQueryOptions(promql: string) {
  return queryOptions({
    queryKey: metricsKeys.query(promql),
    queryFn: () =>
      apiClient<PrometheusResult>("/api/metrics/api/v1/query", {
        params: { query: promql },
      }),
    refetchInterval: 15_000,
  });
}

export function metricsRangeQueryOptions(
  promql: string,
  start: string,
  end: string,
  step: string,
) {
  return queryOptions({
    queryKey: metricsKeys.range(promql, start, end, step),
    queryFn: () =>
      apiClient<PrometheusResult>("/api/metrics/api/v1/query_range", {
        params: { query: promql, start, end, step },
      }),
  });
}
```

- [ ] **Step 3: Write graph schemas and query options**

`frontend/services/graph/schema.ts`:
```typescript
import { z } from "zod";

export const topologyNodeSchema = z.object({
  name: z.string(),
  type: z.string().nullable(),
  labels: z.array(z.string()),
});

export const topologyEdgeSchema = z.object({
  source: z.string(),
  relationship: z.string(),
  target: z.string(),
});

export const topologyResponseSchema = z.object({
  nodes: z.array(topologyNodeSchema),
  edges: z.array(topologyEdgeSchema),
});

export const blastRadiusResponseSchema = z.object({
  service: z.string(),
  affected_services: z.array(z.string()),
});

export const runbookSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.string(),
  steps: z.array(z.string()),
});

export const incidentSchema = z.object({
  id: z.string(),
  title: z.string(),
  severity: z.string(),
  resolution: z.string().nullable(),
  timestamp: z.string().nullable(),
});

export type TopologyResponse = z.infer<typeof topologyResponseSchema>;
export type BlastRadiusResponse = z.infer<typeof blastRadiusResponseSchema>;
export type Runbook = z.infer<typeof runbookSchema>;
export type Incident = z.infer<typeof incidentSchema>;
```

`frontend/services/graph/query-options.ts`:
```typescript
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import type {
  TopologyResponse,
  BlastRadiusResponse,
  Runbook,
  Incident,
} from "./schema";

export const graphKeys = {
  all: ["graph"] as const,
  topology: () => [...graphKeys.all, "topology"] as const,
  blastRadius: (service: string) => [...graphKeys.all, "blast-radius", service] as const,
  runbooks: (service: string) => [...graphKeys.all, "runbooks", service] as const,
  incidents: (service?: string) => [...graphKeys.all, "incidents", service ?? "all"] as const,
};

export const topologyQueryOptions = queryOptions({
  queryKey: graphKeys.topology(),
  queryFn: () => apiClient<TopologyResponse>("/api/graph/topology"),
  staleTime: 5 * 60 * 1000,
});

export function blastRadiusQueryOptions(service: string) {
  return queryOptions({
    queryKey: graphKeys.blastRadius(service),
    queryFn: () => apiClient<BlastRadiusResponse>(`/api/graph/blast-radius/${service}`),
  });
}

export function runbooksQueryOptions(service: string) {
  return queryOptions({
    queryKey: graphKeys.runbooks(service),
    queryFn: () => apiClient<Runbook[]>(`/api/graph/runbooks/${service}`),
  });
}

export function incidentsQueryOptions(service?: string) {
  return queryOptions({
    queryKey: graphKeys.incidents(service),
    queryFn: () =>
      apiClient<Incident[]>("/api/graph/incidents", {
        params: service ? { service } : {},
      }),
  });
}
```

- [ ] **Step 4: Write pipeline schemas and streaming hook**

`frontend/services/pipeline/schema.ts`:
```typescript
import { z } from "zod";

export const streamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("token"),
    agent: z.string(),
    content: z.string(),
  }),
  z.object({
    type: z.literal("tool_start"),
    agent: z.string(),
    tool: z.string(),
  }),
  z.object({
    type: z.literal("tool_end"),
    agent: z.string(),
    output: z.string(),
  }),
  z.object({
    type: z.literal("agent_complete"),
    agent: z.string(),
    result: z.record(z.unknown()),
  }),
  z.object({
    type: z.literal("done"),
  }),
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;

export type PipelineState = {
  status: "idle" | "running" | "complete" | "error";
  agents: Record<
    string,
    {
      tokens: string;
      toolCalls: Array<{ tool: string; output?: string }>;
      result?: Record<string, unknown>;
    }
  >;
  error?: string;
};

export const AGENT_ORDER = ["monitor_node", "analyst_node", "responder_node"] as const;
```

`frontend/services/pipeline/query-options.ts`:
```typescript
export const pipelineKeys = {
  all: ["pipeline"] as const,
  currentRun: () => [...pipelineKeys.all, "current"] as const,
};
```

`frontend/services/pipeline/use-pipeline.ts`:
```typescript
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientStream } from "@/services/_shared/fetch-client";
import { pipelineKeys } from "./query-options";
import type { PipelineState, StreamEvent } from "./schema";

const INITIAL_STATE: PipelineState = {
  status: "idle",
  agents: {},
};

function mergeEvent(state: PipelineState, event: StreamEvent): PipelineState {
  if (event.type === "done") {
    return { ...state, status: "complete" };
  }

  const agent = "agent" in event ? event.agent : "";
  const prev = state.agents[agent] ?? { tokens: "", toolCalls: [] };

  switch (event.type) {
    case "token":
      return {
        ...state,
        status: "running",
        agents: {
          ...state.agents,
          [agent]: { ...prev, tokens: prev.tokens + event.content },
        },
      };
    case "tool_start":
      return {
        ...state,
        agents: {
          ...state.agents,
          [agent]: {
            ...prev,
            toolCalls: [...prev.toolCalls, { tool: event.tool }],
          },
        },
      };
    case "tool_end":
      return {
        ...state,
        agents: {
          ...state.agents,
          [agent]: {
            ...prev,
            toolCalls: prev.toolCalls.map((tc, i) =>
              i === prev.toolCalls.length - 1 ? { ...tc, output: event.output } : tc,
            ),
          },
        },
      };
    case "agent_complete":
      return {
        ...state,
        agents: {
          ...state.agents,
          [agent]: { ...prev, result: event.result },
        },
      };
    default:
      return state;
  }
}

export function usePipelineStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: {
      llmProvider?: string;
      llmModel?: string;
    }) => {
      // Reset state
      queryClient.setQueryData(pipelineKeys.currentRun(), INITIAL_STATE);

      const res = await apiClientStream("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: params.llmProvider ?? "anthropic",
          llm_model: params.llmModel ?? null,
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          try {
            const event = JSON.parse(json) as StreamEvent;
            queryClient.setQueryData(
              pipelineKeys.currentRun(),
              (old: PipelineState | undefined) => mergeEvent(old ?? INITIAL_STATE, event),
            );
          } catch {
            // skip malformed events
          }
        }
      }
    },
    onError: (error) => {
      queryClient.setQueryData(pipelineKeys.currentRun(), (old: PipelineState | undefined) => ({
        ...(old ?? INITIAL_STATE),
        status: "error" as const,
        error: error.message,
      }));
    },
  });
}
```

- [ ] **Step 5: Write anomaly schemas and actions**

`frontend/services/anomaly/schema.ts`:
```typescript
import { z } from "zod";

export const injectRequestSchema = z.object({
  service: z.string(),
  anomaly_type: z.string(),
});

export type InjectRequest = z.infer<typeof injectRequestSchema>;

export const ANOMALY_TYPES = [
  "latency",
  "error",
  "memory_leak",
  "cache_failure",
  "cache_degraded",
] as const;

export const SERVICES = [
  "api-gateway",
  "payment-service",
  "user-service",
  "order-service",
  "redis-cache",
] as const;

export const SCENARIOS = ["cascade"] as const;
```

`frontend/services/anomaly/actions.ts`:
```typescript
"use server";

import { serverFetch, apiBackendUrl } from "@/services/_shared/fetch-server";
import { safeAction } from "@/services/_shared/safe-action";

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

export async function resetAnomalies() {
  return safeAction(
    () =>
      serverFetch(apiBackendUrl, "/anomaly/reset", {
        method: "POST",
      }),
    { code: "ANOMALY_RESET_FAILED", message: "Failed to reset anomalies" },
  );
}
```

`frontend/services/anomaly/query-options.ts`:
```typescript
export const anomalyKeys = {
  all: ["anomaly"] as const,
  history: () => [...anomalyKeys.all, "history"] as const,
};
```

- [ ] **Step 6: Write RAG schemas and actions**

`frontend/services/rag/schema.ts`:
```typescript
import { z } from "zod";

export const ragResultSchema = z.object({
  query: z.string(),
  graphrag: z.object({
    runbook_results: z.array(z.record(z.unknown())),
    incident_results: z.array(z.record(z.unknown())),
    service_context: z.record(z.unknown()).nullable().optional(),
  }),
  naive: z.object({
    runbook_results: z.array(z.record(z.unknown())),
    incident_results: z.array(z.record(z.unknown())),
  }),
});

export type RagResult = z.infer<typeof ragResultSchema>;
```

`frontend/services/rag/actions.ts`:
```typescript
"use server";

import { serverFetch, apiBackendUrl } from "@/services/_shared/fetch-server";
import { safeAction } from "@/services/_shared/safe-action";
import type { RagResult } from "./schema";

export async function evaluateRag(query: string, serviceContext?: string) {
  return safeAction(
    () =>
      serverFetch<RagResult>(apiBackendUrl, "/rag/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          service_context: serviceContext ?? null,
          top_k: 5,
        }),
      }),
    { code: "RAG_EVAL_FAILED", message: "Failed to evaluate RAG" },
  );
}
```

`frontend/services/rag/query-options.ts`:
```typescript
export const ragKeys = {
  all: ["rag"] as const,
  evaluation: (query: string) => [...ragKeys.all, "eval", query] as const,
};
```

- [ ] **Step 7: Commit**

```bash
git add frontend/services/
git commit -m "feat: add all service-layer schemas, query options, and actions"
```

- [ ] **Step 8: Verify frontend builds with services layer**

```bash
cd frontend && pnpm build
```

Expected: Build succeeds. If TypeScript errors appear, fix them before proceeding.

---

## Phase 5: Frontend Pages

### Task 14: Install shadcn components needed for pages

**Files:**
- Modified by shadcn CLI: `frontend/components/ui/` (multiple files)

- [ ] **Step 1: Install shadcn components**

```bash
cd frontend
pnpm dlx shadcn@latest add card badge separator tabs select input textarea scroll-area dialog alert-dialog tooltip sidebar -y
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/
git commit -m "feat: add shadcn UI components"
```

### Task 15: Create layout with sidebar navigation

**Files:**
- Create: `frontend/components/layout/app-sidebar.tsx`
- Create: `frontend/components/layout/status-indicator.tsx`
- Modify: `frontend/app/layout.tsx`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Write frontend/components/layout/status-indicator.tsx**

```tsx
import { cn } from "@/lib/utils";

type Status = "healthy" | "unhealthy" | "unreachable";

export function StatusIndicator({ status }: { status: Status }) {
  return (
    <span
      className={cn(
        "inline-block h-2 w-2 rounded-full",
        status === "healthy" && "bg-green-500",
        status === "unhealthy" && "bg-yellow-500",
        status === "unreachable" && "bg-red-500",
      )}
    />
  );
}
```

- [ ] **Step 2: Write frontend/components/layout/app-sidebar.tsx**

Build a sidebar using the shadcn `sidebar` component with navigation links to all 6 pages:
- Home (`/`)
- Dashboard (`/dashboard`)
- Anomaly Injection (`/anomaly`)
- Pipeline Results (`/pipeline`)
- Dependency Graph (`/topology`)
- GraphRAG Eval (`/evaluation`)

Use `lucide-react` icons: `Home`, `Activity`, `Zap`, `Bot`, `Network`, `FlaskConical`.

- [ ] **Step 3: Update layout.tsx with sidebar**

Wrap children in `SidebarProvider` + `AppSidebar` + main content area.

- [ ] **Step 4: Update page.tsx — Home page**

Replace the demo page with a service health overview:
- Use `useSuspenseQuery(healthQueryOptions)` to fetch service statuses
- Render a grid of `Card` components, one per service
- Each card shows service name + `StatusIndicator`
- Overall system status banner at top

Wrap in `Suspense` with a loading skeleton.

- [ ] **Step 5: Verify dev server works**

```bash
cd frontend && pnpm dev
```

Visit `http://localhost:3000` — should see sidebar + service status cards.

- [ ] **Step 6: Commit**

```bash
git add frontend/
git commit -m "feat: add sidebar layout and home page"
```

### Task 16: Dashboard page (Service Health)

**Files:**
- Create: `frontend/app/dashboard/page.tsx`
- Create: `frontend/app/dashboard/_components/service-metrics.tsx`
- Create: `frontend/app/dashboard/_components/metric-chart.tsx`

- [ ] **Step 1: Write metric-chart.tsx**

A reusable recharts `AreaChart` component that accepts Prometheus time-series data and renders it with proper formatting. Props: `data`, `title`, `unit`, `color`.

- [ ] **Step 2: Write service-metrics.tsx**

Client component that:
- Accepts a `serviceName` prop
- Uses `metricsRangeQueryOptions` to fetch P95 latency, request rate, and error rate
- Renders 3 `MetricChart` components in a row
- PromQL queries per service:
  - Latency: `histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{service="${name}"}[5m]))`
  - Request rate: `rate(http_requests_total{service="${name}"}[5m])`
  - Error rate: `rate(http_requests_total{service="${name}",status=~"5.."}[5m])`

- [ ] **Step 3: Write dashboard/page.tsx**

Server component that renders `ServiceMetrics` for each of the 5 services, wrapped in `Suspense` boundaries. Add auto-refresh toggle using a client component.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/dashboard/
git commit -m "feat: add service health dashboard with live metrics"
```

### Task 17: Anomaly Injection page

**Files:**
- Create: `frontend/app/anomaly/page.tsx`
- Create: `frontend/app/anomaly/_components/inject-form.tsx`
- Create: `frontend/app/anomaly/_components/scenario-buttons.tsx`

- [ ] **Step 1: Write scenario-buttons.tsx**

Client component with buttons for preset scenarios:
- "Cascade Failure" — calls `unwrap(await injectScenario("cascade"))`
- "Reset All" — calls `unwrap(await resetAnomalies())`
- Uses `useMutation` wrapping the server actions
- Shows loading state on buttons during injection

- [ ] **Step 2: Write inject-form.tsx**

Client component with:
- Service selector (dropdown from `SERVICES` constant)
- Anomaly type selector (dropdown from `ANOMALY_TYPES` constant)
- "Inject" button
- Uses `useMutation` wrapping `injectAnomaly` server action
- Invalidates health queries on success

- [ ] **Step 3: Write anomaly/page.tsx**

Renders `ScenarioButtons` and `InjectForm` in a two-column layout.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/anomaly/
git commit -m "feat: add anomaly injection page"
```

### Task 18: Pipeline Results page (SSE streaming)

**Files:**
- Create: `frontend/app/pipeline/page.tsx`
- Create: `frontend/app/pipeline/_components/pipeline-controls.tsx`
- Create: `frontend/app/pipeline/_components/agent-output.tsx`
- Create: `frontend/app/pipeline/_components/pipeline-viewer.tsx`

- [ ] **Step 1: Write agent-output.tsx**

Client component that displays output for a single agent:
- Props: `agentName`, `data` (tokens, toolCalls, result)
- Renders streaming tokens in a `ScrollArea` with monospace font
- Shows tool calls as collapsible items (tool name + truncated output)
- Shows completion badge when agent result is available

- [ ] **Step 2: Write pipeline-controls.tsx**

Client component with:
- LLM provider selector (Anthropic / Ollama radio buttons)
- Ollama model input (shown only when Ollama selected)
- "Run Pipeline" button
- Uses `usePipelineStream()` hook
- Disables button while pipeline is running

- [ ] **Step 3: Write pipeline-viewer.tsx**

Client component that:
- Reads pipeline state from `useQuery(pipelineKeys.currentRun())`
- Renders 3 `AgentOutput` components (Monitor, Analyst, Responder) in order
- Shows progress indicator (which agent is active)
- Shows error state if pipeline fails

- [ ] **Step 4: Write pipeline/page.tsx**

Renders `PipelineControls` and `PipelineViewer`.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/pipeline/
git commit -m "feat: add pipeline results page with SSE streaming"
```

### Task 19: Dependency Graph page (topology visualization)

**Files:**
- Create: `frontend/app/topology/page.tsx`
- Create: `frontend/app/topology/_components/topology-graph.tsx`
- Create: `frontend/app/topology/_components/blast-radius-panel.tsx`

- [ ] **Step 1: Write topology-graph.tsx**

Client component using `@xyflow/react`:
- Fetches topology via `useSuspenseQuery(topologyQueryOptions)`
- Maps `nodes` → React Flow nodes (positioned with a simple layout algorithm or dagre)
- Maps `edges` → React Flow edges with relationship labels
- On node click: triggers blast radius query
- Highlights affected nodes when blast radius is shown
- Custom node component with service name and status color

- [ ] **Step 2: Write blast-radius-panel.tsx**

Side panel that:
- Shows selected service name
- Fetches blast radius via `useSuspenseQuery(blastRadiusQueryOptions(service))`
- Lists affected services
- Fetches runbooks via `useSuspenseQuery(runbooksQueryOptions(service))`
- Shows runbook steps in expandable sections

- [ ] **Step 3: Write topology/page.tsx**

Full-height layout with the graph taking most of the space and the blast radius panel on the right (collapsible).

- [ ] **Step 4: Commit**

```bash
git add frontend/app/topology/
git commit -m "feat: add interactive dependency graph with blast radius"
```

### Task 20: GraphRAG Evaluation page

**Files:**
- Create: `frontend/app/evaluation/page.tsx`
- Create: `frontend/app/evaluation/_components/eval-form.tsx`
- Create: `frontend/app/evaluation/_components/comparison-chart.tsx`
- Create: `frontend/app/evaluation/_components/results-table.tsx`

- [ ] **Step 1: Write eval-form.tsx**

Client component with:
- Query text input
- Optional service context input
- "Evaluate" button
- Uses `useMutation` wrapping `evaluateRag` server action
- Stores results in query cache via `queryClient.setQueryData(ragKeys.evaluation(query), result)`

- [ ] **Step 2: Write comparison-chart.tsx**

Component using recharts `BarChart`:
- Shows side-by-side bars for GraphRAG vs Naive RAG
- Metrics: runbook result count, incident result count, has service context (boolean → 1/0)
- Color-coded: GraphRAG = blue, Naive = gray

- [ ] **Step 3: Write results-table.tsx**

Two-column layout showing:
- Left: GraphRAG results (runbooks + incidents with graph context)
- Right: Naive RAG results (flat runbooks + incidents)
- Highlights differences (extra fields in GraphRAG results)

- [ ] **Step 4: Write evaluation/page.tsx**

Renders `EvalForm`, `ComparisonChart`, and `ResultsTable` vertically.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/evaluation/
git commit -m "feat: add GraphRAG evaluation page with comparison charts"
```

---

## Phase 6: Docker Integration

### Task 21: Update docker-compose.yml

**Files:**
- Modify: `docker-compose.yml`
- Create: `frontend/Dockerfile`

- [ ] **Step 1: Write frontend/Dockerfile**

```dockerfile
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-alpine AS runner

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@10 --activate

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000

CMD ["node", "server.js"]
```

- [ ] **Step 2: Add `output: "standalone"` to next.config.mjs**

```typescript
const nextConfig = {
  output: "standalone",
};
```

- [ ] **Step 3: Add api-backend and frontend to docker-compose.yml**

Add the two new services as specified in the design spec (with healthcheck, Grafana env vars, Ollama support, `service_healthy` condition).

- [ ] **Step 4: Test Docker build**

```bash
docker compose build api-backend frontend
```

Expected: Both images build successfully.

- [ ] **Step 5: Test full stack**

```bash
docker compose up -d
```

Verify:
- `http://localhost:3001` — Next.js frontend loads
- `http://localhost:8090/health` — API backend responds
- All existing services still work

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml frontend/Dockerfile frontend/next.config.mjs
git commit -m "feat: add Docker support for api-backend and frontend"
```

### Task 22: Final verification

- [ ] **Step 1: Run Python unit tests**

```bash
uv run pytest tests/unit/ -v
```

- [ ] **Step 2: Run frontend build**

```bash
cd frontend && pnpm build
```

- [ ] **Step 3: Run frontend lint**

```bash
cd frontend && pnpm lint
```

- [ ] **Step 4: Run Python linting**

```bash
uv run ruff check agents/ graph/ api-backend/ scripts/
```

- [ ] **Step 5: Verify all Docker services are healthy**

```bash
docker compose ps
curl http://localhost:8090/health
curl http://localhost:3001
```

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "chore: final verification pass"
```
