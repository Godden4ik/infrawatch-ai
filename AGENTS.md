# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**InfraWatch AI** — a capstone project for PJATK Master's program. An AI-powered infrastructure monitoring system that integrates MCP (Model Context Protocol), multi-agent orchestration (LangGraph), and GraphRAG for DevOps incident management.

## Tech Stack

- **Language**: Python 3.12+
- **AI/Orchestration**: LangChain, LangGraph, Anthropic API (claude-haiku-4-5-20251001), Ollama (optional local backend via `langchain-ollama`)
- **Embeddings**: sentence-transformers `all-MiniLM-L6-v2` (local, used for Neo4j vector search)
- **Monitoring**: Prometheus, Grafana
- **Graph Database**: Neo4j (topology store + GraphRAG)
- **Infrastructure**: Docker, Docker Compose
- **Frontend**: Next.js 16, React 19, TanStack Query, shadcn/ui (base-lyra preset), Tailwind CSS v4, Zod, motion/react
- **Frontend Icons**: @lobehub/icons (provider brand logos), lucide-react, react-icons
- **Testing**: pytest, pytest-asyncio, httpx (backend); vitest, @testing-library/react (frontend)

## Commands

```bash
docker compose up          # Deploy full stack (Prometheus, Grafana, Neo4j, services)
python graph/seed.py       # Seed Neo4j topology (run once after compose up)
python graph/ingest.py     # Ingest runbooks + incidents into Neo4j (local embeddings)

cd frontend && pnpm dev    # Launch Next.js frontend on http://localhost:3001
cd frontend && pnpm build  # Production build
cd frontend && pnpm typecheck  # TypeScript type check
cd frontend && pnpm lint   # ESLint

pytest tests/unit/         # Unit tests — no services needed
pytest tests/integration/  # Integration tests — requires docker compose up
pytest tests/e2e/          # End-to-end scenario tests — requires docker compose up
pytest                     # All tests

python scripts/inject_anomaly.py cascade        # Inject cascade failure scenario
python scripts/inject_anomaly.py reset          # Clear all anomalies
python scripts/inject_anomaly.py latency payment-service  # Inject on specific service

python scripts/evaluate_rag.py                        # GraphRAG vs Naive RAG comparison (Anthropic judge)
python scripts/evaluate_rag.py --json                 # Structured output
python scripts/evaluate_rag.py --query 3              # Single query
python scripts/evaluate_rag.py --provider ollama --model qwen2.5:14b  # Ollama judge

python -c "import asyncio; from agents import run_pipeline; print(asyncio.run(run_pipeline()))"  # Run agent pipeline (Anthropic)
python -c "import asyncio; from agents import run_pipeline; print(asyncio.run(run_pipeline(llm_provider='ollama', llm_model='qwen2.5:14b')))"  # Ollama backend
```

## Package Management

Use `pip3 install <pkg> --break-system-packages` to install Python packages.

## Git Workflow

All new work goes on a feature branch and is merged via pull request — never commit directly to `master`.

```bash
git checkout -b feature/<name>
# ... make changes ...
gh pr create
```

## Architecture

### Repository Layout

```
frontend/      # Next.js 16 app (React 19, shadcn/ui, TanStack Query)
api_backend/   # FastAPI control plane (routes, Pydantic models)
agents/        # LangGraph pipeline: Monitor → Analyst → Responder + provider registry
services/      # Simulated microservices emitting Prometheus metrics
mcp-servers/   # Three MCP servers: Grafana, Prometheus, Neo4j
graph/         # Neo4j schemas, seed data, GraphRAG pipeline
ui/            # Legacy Streamlit dashboard (kept for reference, not deployed)
tests/         # unit/ integration/ e2e/
scripts/       # inject_anomaly.py, evaluate_rag.py
```

### Agent Pipeline

The core flow is a LangGraph-orchestrated pipeline:

```
Monitor Agent → Analyst Agent → Responder Agent
```

- **Monitor**: Polls Prometheus/Grafana via MCP, detects anomalies
- **Analyst**: Queries Neo4j graph topology to find root causes
- **Responder**: Drafts remediation actions based on analysis

**Key implementation details:**
- Persistent MCP sessions: `agents/__init__.py` opens one subprocess per MCP server for the full pipeline run (one session for prometheus, grafana, neo4j) — avoids reloading the sentence-transformers model on every tool call
- Tool result truncation: 3000 chars max per tool result to keep context within 30k TPM rate limit
- max_tool_rounds: monitor=3, analyst=4, responder=3
- Default model: `claude-haiku-4-5-20251001` (cheapest, sufficient for structured tool calling)
- Streaming: `stream_pipeline()` yields `astream_events(version="v2")` events; the UI renders live token output and tool call progress per agent node
- Anomaly parsing: `_parse_anomalies()` only accepts a `\`\`\`json` fenced block that parses to a list with all required fields (`service`, `metric`, `value`, `threshold`, `severity`) — rejects hallucinated or malformed output

**LLM Provider Registry** (`agents/providers.py`):
- Pluggable provider system — new provider = one dict entry in `PROVIDER_REGISTRY` + `pip install langchain-<provider>`
- Registered: `anthropic`, `openai`, `gemini`, `ollama`
- `get_llm(provider, model, temperature, api_key)` uses `importlib.import_module` for lazy loading
- Each entry specifies `key_kwarg` for provider-specific constructor kwargs (e.g., `google_api_key` for Gemini)
- Runtime API keys accepted per-request — never stored, never logged
- Provider + model + api_key threaded through `run_pipeline` / `stream_pipeline` → `build_graph` → each node via `functools.partial`
- Ollama requires ≥14B model for reliable structured tool calling; 7B models hallucinate tool results in multi-step pipelines

### Live Metrics Stream

`GET /metrics/stream` (`api_backend/routes/metrics_stream.py`) — SSE endpoint that polls all 26 Prometheus metrics every 2 seconds and emits batched JSON events. Frontend consumes via `useMetricsStream()` hook (module-level singleton EventSource + circular buffer, 150 points ≈ 5min). Both sparkline cards and nivo LiveMonitor charts share the same stream. Proxied through `frontend/src/app/api/metrics/stream/route.ts`.

### MCP Servers

Each MCP server exposes domain-specific tools to agents:

| Server | Tools |
|--------|-------|
| Prometheus MCP (`mcp-servers/prometheus_mcp/server.py`) | `execute_promql`, `list_metrics`, `get_targets` |
| Grafana MCP (`mcp-servers/grafana_mcp/server.py`) | `list_dashboards`, `get_dashboard`, `get_panel`, `list_alerts` |
| Neo4j MCP (`mcp-servers/neo4j_mcp/server.py`) | `run_cypher`, `get_service_dependencies`, `get_blast_radius`, `search_runbooks`, `find_similar_incidents`, `get_runbook_for_service`, `search_knowledge_base` |

### Next.js Frontend (`frontend/`)

**Stack**: Next.js 16, React 19, TanStack Query, shadcn/ui (base-lyra preset `b4XK2a41RI`), Tailwind CSS v4, Zod, motion/react, @lobehub/icons, nuqs

**Pages:**

| Route | Purpose |
|-------|---------|
| `/` | System overview — connectivity checks |
| `/dashboard` | Service health — SSE-streamed sparklines + full nivo live monitor (2s refresh, 5m window) |
| `/anomaly` | Anomaly injection — presets + manual |
| `/pipeline` | Agent pipeline — SSE streaming, ProviderSelector |
| `/topology` | Dependency graph — XYFlow interactive |
| `/evaluation` | GraphRAG eval — side-by-side comparison, judge ProviderSelector |

**Skill Usage — MANDATORY:**

| Working on | Load skill FIRST |
|------------|-----------------|
| Any new page or UI surface | Read `frontend/docs/patterns/page-layout.md` first. Pick pattern B/C/D. State it. |
| Any `components/ui/` or UI change | `shadcn` skill — check registry + audit |
| After completing UI work | Run `/arch-review` agent to verify compliance |

**Do NOT use `frontend-design`** for pages. Follow `frontend/docs/patterns/page-layout.md` instead.

**Frontend Architecture Rules (adapted from Salon Svitlo CRM):**

1. **Services Layer** (`src/services/{domain}/`): Each resource has `schema.ts` (Zod DTOs), `query-options.ts` (TanStack Query key factories), `actions.ts` (server actions with `safeAction`). Client hooks use `unwrap(await action())`.

2. **Client-Server Proxy**: All client→backend goes through Next.js API route handlers (`app/api/[service]/[...path]/route.ts`). Sensitive data (API URLs, keys) stays server-side.

3. **TanStack Query is sole caching layer**: Never use Next.js `cache`, `revalidateTag`, or ISR. `apiServer` uses `cache: "no-store"`.

4. **State management**: Server state → TanStack Query. URL state → nuqs. Client UI state → React state (no Zustand yet). No duplication.

5. **Components**: `ui/` = shadcn primitives. Domain composites in page `_components/` folders or `src/components/`.

6. **Styling**: Tailwind v4 CSS-based config. Use semantic tokens (`text-foreground`, `bg-card`, `border-border`) — never raw colors. `cn()` utility for className merging.

7. **Provider icons**: `@lobehub/icons` for brand logos (Anthropic, OpenAI, Gemini.Color, Ollama). Fallback to `lucide-react` BrainCircuit for unknown providers. Display map at `src/lib/provider-display.ts`.

8. **Runtime API keys**: Stored in `sessionStorage` per provider. Sent per-request in body. Never persisted. `src/lib/provider-keys.ts`.

9. **Charts**: nivo only (never recharts). `@nivo/line`, `@nivo/bar`, `@nivo/radar`, `@nivo/pie`, `@nivo/heatmap`. Always use `Responsive*` wrappers. Colors from CSS variables.

10. **Density**: This is a monitoring tool. Padding: `p-3` stat cards, `p-4` content cards. Gaps: `gap-3` cards, `gap-4` sections. Font: `text-xs` labels, `text-sm` body, `text-base` headings. See `frontend/docs/patterns/page-layout.md`.

11. **Page patterns**: Every page fits pattern B (bento), C (hybrid), or D (split-pane). See `frontend/docs/patterns/page-layout.md` for decision flow and anatomy.

### GraphRAG vs Naive RAG

A key deliverable is demonstrating GraphRAG superiority for topology-dependent queries (e.g., blast radius analysis). Runbooks and incident reports are ingested into Neo4j alongside the infrastructure topology graph. The `sentence-transformers` model generates embeddings; the Anthropic API is **not** used for embeddings.

**LLM-as-judge** (`scripts/evaluate_rag.py` / `/evaluation` page):
- Scores retrieved content on `content_relevance` and `actionability` (1–10 integers) per query
- Uses `get_llm()` from provider registry — any registered provider works as judge
- Both GraphRAG and Naive RAG retrieve the same documents (high Jaccard content overlap); the judge scores are expected to be similar — the structural metrics (service coverage, context richness) are where GraphRAG wins
- CLI flags: `--provider <any_registered_id>`, `--model <name>`

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Docker Compose + simulated services + tests | ✅ Complete |
| Phase 2 | MCP servers (Grafana, Prometheus, Neo4j) | ✅ Complete |
| Phase 3 | LangGraph agent pipeline | ✅ Complete |
| Phase 4 | GraphRAG pipeline + runbook ingestion | ✅ Complete |
| Phase 5 | Streamlit UI + demo scenarios | ✅ Complete |

## Healthy Service Baselines

| Service | P95 Latency | Anomaly Threshold | Notes |
|---------|-------------|-------------------|-------|
| api-gateway | ~100 ms | > 400 ms | |
| payment-service | ~930 ms | > 2000 ms | baseline failure rate ~3% is normal |
| user-service | ~100 ms | > 350 ms | |
| order-service | ~2300 ms | > 5000 ms | high baseline due to DB simulation |
| redis-cache | hit ratio ~92% | hit ratio < 50% | no latency histogram metric |

## Assessment Weights

| Component | Weight |
|-----------|--------|
| Technical Implementation (code, Docker, MCP design) | 40% |
| Graph Design (Neo4j schema, query efficiency, GraphRAG) | 20% |
| Agent Orchestration (LangGraph, agent specialization) | 20% |
| Documentation | 10% |
| Presentation & Demo | 10% |

## MCP Server Environment Variables

| Variable | Default | Used by |
|----------|---------|---------|
| `PROMETHEUS_URL` | `http://localhost:9090` | Prometheus MCP |
| `GRAFANA_URL` | `http://localhost:3000` | Grafana MCP |
| `GRAFANA_USER` | `admin` | Grafana MCP |
| `GRAFANA_PASSWORD` | `infrawatch` | Grafana MCP |
| `NEO4J_URI` | `bolt://localhost:7687` | Neo4j MCP, Streamlit UI |
| `NEO4J_USER` | `neo4j` | Neo4j MCP, Streamlit UI |
| `NEO4J_PASSWORD` | `infrawatch` | Neo4j MCP, Streamlit UI |

MCP servers use stdio transport — agents invoke them as subprocesses.

## Service Ports (local)

| Service | Port |
|---------|------|
| api-gateway | 8080 |
| payment-service | 8001 |
| user-service | 8002 |
| order-service | 8003 |
| redis-cache | 8004 |
| Prometheus | 9090 |
| Grafana | 3000 (admin / infrawatch) |
| Neo4j HTTP | 7474 (neo4j / infrawatch) |
| Neo4j Bolt | 7687 |
| FastAPI Backend | 8090 |
| Next.js Frontend | 3001 |
