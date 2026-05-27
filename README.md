# InfraWatch AI

AI-powered infrastructure monitoring system using MCP, LangGraph multi-agent orchestration, and GraphRAG for DevOps incident management. Capstone project for PJATK Master's program.

## Architecture

```
  ┌───────────────────────────────────────────────────────────────┐
  │   Next.js 16 Frontend  (port 3001)                            │
  │   Supabase-grade dark UI · view transitions · TanStack Query  │
  │   shadcn/ui + tokenized severity/brand palette · nivo charts  │
  │   Overview · Service Health · Anomaly · Pipeline · Topology   │
  │   Evaluation · Accuracy · Providers                           │
  └────────────────────────┬──────────────────────────────────────┘
                           │ HTTP / SSE
  ┌────────────────────────▼──────────────────────────────────────┐
  │   FastAPI api_backend  (port 8090)                            │
  │   /health  /metrics  /anomaly  /pipeline (SSE)  /graph  /rag  │
  └────────────────────────┬──────────────────────────────────────┘
                           │ Python async
  ┌────────────────────────▼──────────────────────────────────────┐
  │              LangGraph Agent Pipeline                         │
  │   Monitor Agent → Analyst Agent → Responder Agent             │
  │   Anthropic · OpenAI · Gemini · DeepSeek · Ollama             │
  └────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │  MCP stdio
  Prometheus MCP      Neo4j MCP          Grafana MCP
       │                  │
  Prometheus ←── 5 microservices     Neo4j GraphRAG
   (metrics)                          (runbooks + topology)
```

Five simulated microservices emit Prometheus metrics. Agents detect anomalies, trace root causes through a Neo4j dependency graph enriched with runbooks and historical incidents, and draft remediation plans — streamed live to the Next.js frontend via SSE.

A Streamlit dashboard (`ui/`) is available as a lightweight fallback.

## Quick Start

**Prerequisites:** Docker, Docker Compose, Python 3.12+, Node.js 20+ / pnpm, Anthropic API key (or Ollama for local inference)

```bash
# 1. Start the full stack (includes api_backend on 8090 and frontend on 3001)
docker compose up

# 2. Seed the Neo4j topology graph (first time only)
python graph/seed.py

# 3. Ingest runbooks + incidents into knowledge base (local embeddings)
python graph/ingest.py

# 4. Open the dashboard
#   → Next.js:   http://localhost:3001
#   → Streamlit: streamlit run ui/app.py  (http://localhost:8501)

# Optional: open infrastructure tools directly
#   Grafana:    http://localhost:3000  (admin / infrawatch)
#   Prometheus: http://localhost:9090
#   Neo4j:      http://localhost:7474  (neo4j / infrawatch)
```

Copy `.env.example` to `.env` and set your API key — all other values default to the Docker Compose stack:

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

### Frontend development (without Docker)

```bash
cd frontend
pnpm install
pnpm dev          # http://localhost:3001  (uses MSW mocks — no backend needed)
pnpm test         # Vitest: 49 unit tests
pnpm build        # Production build
```

## Next.js Frontend

| Page | Route | Description |
|------|-------|-------------|
| **Overview** | `/` | System status grid — service health cards (click to open a detail Sheet), Grafana / Prometheus / Neo4j launchers, configured LLM providers |
| **Service Health** | `/dashboard` | Live Prometheus stream — sparkline cards per service plus a full 26-metric live monitor (2 s refresh · 5 min window). Slice-hover tooltips on every chart. |
| **Anomaly Injection** | `/anomaly` | Dense fault-control surface — manual injection, cascade presets, active fault ledger, event journal, live server-reported fault state per service |
| **Agent Pipeline** | `/pipeline` | Split-pane SSE runtime console for Monitor → Analyst → Responder with terminal-style streaming, brand-accented active stage, framed tool-call blocks |
| **Topology** | `/topology` | Orthogonal dependency graph (XYFlow) with animated dashed edges + blast-radius panel. Selected node and affected services highlight with semantic tokens. |
| **RAG Evaluation** | `/evaluation` | Side-by-side GraphRAG vs Naive RAG comparison — judge score stat blocks, retrieved-document panels with brand accent on the GraphRAG side, nivo radar/bar charts |
| **Accuracy Benchmark** | `/evaluation/benchmark` | Run the agent pipeline against a gold dataset, stream Live Console with PASS/FAIL coloring, summarize Precision / Recall / F1 / Items in a 4-up grid |
| **Providers** | `/providers` | LLM provider key management — store, test, and rotate API keys for Anthropic / OpenAI / Gemini / DeepSeek; Ollama needs no key |

MSW mock service workers provide realistic API responses in development so the frontend works without a running backend.

### Frontend UX

- **View transitions** — route navigation uses the browser View Transitions API (enabled via Next.js `experimental.viewTransition`). Header chrome, system-status pill, and the active route tab indicator stay anchored across navigations. Service cards on `/` and `/dashboard` morph into nodes on `/topology` via shared `view-transition-name`.
- **Tech grid background** — subtle 32 px linear-gradient grid lines behind every page, fixed attachment (Vercel / Supabase aesthetic). Cards float opaque over the grid.
- **Hierarchical breadcrumbs** — every route resolves to a chevron-separated chain with clickable parents (`InfraWatch › RAG Evaluation › Accuracy Benchmark`).
- **Header external launchers** — Grafana / Prometheus / Neo4j brand-icon buttons next to the System Online pill, always one click from the relevant external dashboard.
- **Semantic color tokens** — every status surface uses `--status-{healthy,degraded,critical,unknown}` and `--brand` (electric violet 290°). No raw palette classes anywhere in app code. Documented in `frontend/AGENTS.md`.
- **Restraint** — focus rings, motion variants, and card tones are configured for monitoring density: subtle stagger entrance (20 ms / 30 ms / 180 ms / 2 px), `prefers-reduced-motion` honored throughout, no glow or marketing animation.

## Streamlit Dashboard (fallback)

| Page | Description |
|------|-------------|
| **Home** | System connectivity status for all services |
| **Service Health** | Real-time Prometheus metrics with SLO indicators |
| **Anomaly Injection** | Inject cascade/latency/error scenarios + trigger pipeline |
| **Pipeline Results** | Live-streaming Monitor → Analyst → Responder output; token stream + tool call events per agent |
| **Dependency Graph** | Interactive Neo4j topology with health-colored nodes |
| **GraphRAG Eval** | Side-by-side comparison with Plotly charts; LLM-as-judge via Anthropic or Ollama |

## Service Ports

| Service | Port |
|---------|------|
| api-gateway | 8080 |
| payment-service | 8001 |
| user-service | 8002 |
| order-service | 8003 |
| redis-cache | 8004 |
| FastAPI api_backend | 8090 |
| Prometheus | 9090 |
| Grafana | 3000 |
| Neo4j HTTP | 7474 |
| Neo4j Bolt | 7687 |
| Next.js Frontend | 3001 |
| Streamlit UI | 8501 |

## Demo Walkthrough

The full demo runs in approximately 5–7 minutes using the Next.js dashboard. All services start with a single `docker compose up`.

**1. Start the stack and seed data** (first time only)
```bash
docker compose up -d
python graph/seed.py    # loads Neo4j topology
python graph/ingest.py  # embeds runbooks + incidents
```

**2. Open the dashboard** at [http://localhost:3001](http://localhost:3001). The **Overview** page shows:
- **Services Online** stat (7/7 in green when healthy)
- Microservice cards — each clickable, opens a **Service Detail Sheet** with status, quick actions (View on Topology, View Metrics, Inject Anomaly)
- **Infrastructure Tools** row — direct launchers for Grafana, Prometheus, Neo4j with live status dots
- **LLM Providers** chips — `READY` (configured), `LOCAL` (Ollama), `NO KEY` (degraded)

Header strip launchers (top-right) are always one click from the external dashboards.

**3. Verify provider keys** — go to **Providers** and ensure at least one provider shows a `CONFIGURED` StatusPill. Anthropic/OpenAI/Gemini/DeepSeek take a key; Ollama needs `ollama serve` running locally.

**4. Inject a cascade failure** — **Anomaly Injection** → run **Inject cascade** from Preset Scenarios. Watch the Live Status panel pivot the affected services to a `degraded` / `critical` StatusPill in real time (5 s poll).

**5. Wait ~60 seconds** for Prometheus to scrape the new values, then check **Service Health** — the sparkline cards for `payment-service` / `order-service` / `redis-cache` flip from `Healthy` to `Degraded` / `Critical` and the per-metric trend lines color-shift to amber / red.

**6. Run the agent pipeline** — **Agent Pipeline** → pick a provider in the control pane, click **Launch trace**. The right-side execution console renders:
- An eyebrow-tagged section per stage (Monitor / Analyst / Responder) with a brand-violet left edge on whichever stage is currently streaming
- Tool-call entries as framed mono blocks with `eyebrow / args / line-clamped output`
- A `█` cursor in brand color pulsing at the end of the active token stream
- The responder's final markdown plan, with runbook citations rendered inline

**7. Show the Topology graph** — **Topology** → click `redis-cache`. The selected node gains a violet border + ring, affected services (`payment-service`, `order-service`) gain a status-critical border + faint critical-tinted background, and edges in the blast path animate faster in critical red. A floating `"N services affected"` StatusPill appears next to the legend. The right panel lists each affected service with a `StatusBar` left-edge accent and matched runbooks (P1 / P2 / P3).

  *Bonus:* navigate from **Service Health** → **Topology** to see the dashboard's per-service sparkline cards morph into topology nodes via shared view-transition-names.

**8. Show the GraphRAG evaluation** — **Evaluation** → enter a topology-heavy query (or pick a preset) and click **Compare**. Point out:
- Service Coverage: GraphRAG `1.00` vs Naive RAG `0.00` on cascade queries
- Context Richness: GraphRAG returns structured service relationship fields; Naive RAG returns none
- Judge Scores: similar — same documents retrieved; topology enrichment is the differentiator
- Side-by-side panels — GraphRAG side has a brand-violet header accent; Naive side is neutral

**9. Run the Accuracy Benchmark** *(optional, ~30–60 s)* — **Accuracy** → click **Start Benchmark**. Live Console streams pipeline output with PASS/FAIL coloring; a 4-up summary grid (Precision / Recall / F1 / Items Evaluated) appears on completion.

**10. Reset** — return to **Anomaly Injection** → **Reset all services**. The fault ledger clears, Service Health cards return to green, and the topology blast-radius highlighting disappears.

## Anomaly Injection

Inject scenarios via the UI (Anomaly Injection page) or CLI:

```bash
# Cascade failure: Redis cache down → payment + order DB fallback (~7s latency)
python scripts/inject_anomaly.py cascade

# Inject a specific anomaly type on specific services
python scripts/inject_anomaly.py latency payment-service order-service
python scripts/inject_anomaly.py error api-gateway
python scripts/inject_anomaly.py cache_failure redis-cache

# Clear all anomalies
python scripts/inject_anomaly.py reset
```

Wait ~60 s after injection for Prometheus to scrape the new values before running the pipeline.

## Agent Pipeline

Run the full Monitor → Analyst → Responder pipeline:

```bash
python -c "import asyncio; from agents import run_pipeline; print(asyncio.run(run_pipeline()))"
```

Or use **Launch trace** on the Agent Pipeline page — the FastAPI backend streams SSE events to the Next.js frontend, rendering each token and tool call in real time.

The pipeline uses persistent MCP server sessions — the Neo4j server (and its embedding model) loads once per run, not once per tool call.

### LLM Backend Selection

Both the agent pipeline and the GraphRAG evaluation support switching backends at runtime. Keys can be supplied either via `.env` (server-side default) or per-request via the `/providers` page (stored in `sessionStorage`, never persisted, sent in the request body).

| Backend | Env key | UI |
|---------|---------|----|
| **Anthropic (default)** | `ANTHROPIC_API_KEY` | Configure on `/providers` · `claude-haiku-4-5-20251001` |
| **OpenAI** | `OPENAI_API_KEY` | Configure on `/providers` · `gpt-4o-mini` default |
| **Gemini** | `GEMINI_API_KEY` | Configure on `/providers` · `gemini-2.0-flash-exp` |
| **DeepSeek** | `DEEPSEEK_API_KEY` | Configure on `/providers` · `deepseek-chat` / `deepseek-reasoner` |
| **Ollama (local)** | — (uses `OLLAMA_URL`, default `http://localhost:11434`) | Pick per-run in UI; needs `ollama serve` + model pulled |

```bash
# Ollama setup (one-time)
ollama pull qwen2.5:14b   # recommended minimum for tool-calling pipelines
ollama pull llama3.1      # usable for LLM-as-judge only (not reliable for agents)
```

> **Note:** The agent pipeline makes 10+ sequential structured tool calls per run. Models below ~14B parameters frequently hallucinate tool results or ignore tool outputs. Anthropic / OpenAI / Gemini / DeepSeek all work reliably for agents; Ollama is fully functional for the GraphRAG LLM-as-judge (single JSON call per query) and works for agents with a ≥14B model.

The CLI also accepts a provider flag via the Python API:

```python
import asyncio
from agents import run_pipeline
asyncio.run(run_pipeline(llm_provider="ollama", llm_model="qwen2.5:14b"))
asyncio.run(run_pipeline(llm_provider="deepseek", llm_model="deepseek-chat"))
```

## MCP Servers

Three FastMCP servers expose infrastructure tools to agents via stdio transport:

| Server | Tools |
|--------|-------|
| Prometheus | `execute_promql`, `list_metrics`, `get_targets` |
| Grafana | `list_dashboards`, `get_dashboard`, `get_panel`, `list_alerts` |
| Neo4j | `run_cypher`, `get_service_dependencies`, `get_blast_radius`, `search_runbooks`, `find_similar_incidents`, `get_runbook_for_service`, `search_knowledge_base` |

## GraphRAG Evaluation

```bash
python scripts/evaluate_rag.py                          # Run all 10 queries, print comparison table
python scripts/evaluate_rag.py --json                   # Structured JSON output
python scripts/evaluate_rag.py --query 3                # Single query (1-indexed)
python scripts/evaluate_rag.py --provider ollama        # Use Ollama as LLM judge
python scripts/evaluate_rag.py --provider ollama --ollama-model qwen2.5:14b
```

GraphRAG outperforms Naive RAG on topology-dependent queries (blast radius, cascade failures) by traversing the dependency graph alongside vector search. Both methods retrieve the same documents (verified by Jaccard content overlap); GraphRAG's advantage is the topology enrichment layer — structured service relationship fields — not better retrieval. The LLM-as-judge scores content quality, where both methods score similarly, isolating the topology layer as GraphRAG's differentiator.

## Testing

```bash
# Python tests
pytest tests/unit/         # 26 tests — no external dependencies
pytest tests/integration/  # 25 tests — requires docker compose up
pytest tests/e2e/          # 4 full-stack scenario tests
pytest                     # All Python tests

# JavaScript tests (frontend)
cd frontend && pnpm test   # 49 Vitest tests — schemas, utils, components
```

## Repository Layout

```
services/              Simulated microservices (FastAPI + Prometheus metrics)
api_backend/           FastAPI backend — SSE pipeline, anomaly proxy, graph/rag routes
  app.py               FastAPI entry point (port 8090)
  routes/              health, pipeline, anomaly, graph, rag
  Dockerfile
frontend/              Next.js 16 frontend — Supabase-grade dark UI
  src/app/             App Router pages (overview, dashboard, anomaly, pipeline,
                       topology, evaluation, evaluation/benchmark, providers)
  src/components/ui/   shadcn primitives + project additions: status-indicator
                       (StatusDot/StatusPill/StatusBar), animated-number,
                       empty-state, card with tone variants
  src/components/layout/  PageHeader, PageMount, breadcrumbs, core-route-tabs,
                       external-tools-strip
  src/lib/             motion-variants, external-services, metric-registry,
                       health-thresholds, provider-display, provider-keys
  src/services/        TanStack Query service layer with Zod schemas
  src/mocks/           MSW mock handlers + fake data fixtures
  src/__tests__/       Vitest tests (51)
  AGENTS.md            Frontend conventions: tokens, motion, view-transition
                       naming, component composition
  Dockerfile
mcp-servers/
  prometheus_mcp/      PromQL queries, metric listing, target health
  grafana_mcp/         Dashboard/panel queries, alert listing
  neo4j_mcp/           Cypher queries, dependency traversal, GraphRAG tools
agents/                LangGraph pipeline: Monitor, Analyst, Responder
graph/
  seed.py              Neo4j topology seeding
  ingest.py            Runbook + incident ingestion (sentence-transformers embeddings)
  retrieval.py         GraphRAG and Naive RAG retrieval functions
  data/                Runbooks, incidents, symptoms YAML corpus
ui/                    Streamlit dashboard (fallback)
  app.py               Streamlit entry point (home + system status)
  pages/               5 dashboard pages
  components/          Prometheus helpers, pyvis graph renderer, pipeline bridge
scripts/
  inject_anomaly.py    Anomaly injection CLI
  evaluate_rag.py      GraphRAG vs Naive RAG evaluation
tests/
  unit/                26 tests — no external dependencies
  integration/         25 tests — requires docker compose up
  e2e/                 4 full-stack scenario tests
docs/                  Project Design Document (PDD) + generation script
prometheus/            prometheus.yml scrape config
grafana/               Provisioned datasources and dashboards
pyproject.toml         Python package config (uv, ruff, pyright)
```

## Python DX

The project uses `uv` for dependency management and `ruff` / `pyright` for linting and type checking:

```bash
uv sync                    # Install all Python dependencies
uv run pytest              # Run tests via uv
ruff check .               # Lint
pyright                    # Type check
```

All `sys.path.insert()` hacks have been replaced by proper `pyproject.toml` package discovery (`package-dir` mappings for `api_backend` and `mcp-servers/`).

## Healthy Baselines

| Service | P95 Latency | Anomaly Threshold |
|---------|-------------|-------------------|
| api-gateway | ~100 ms | > 400 ms |
| payment-service | ~930 ms | > 2000 ms |
| user-service | ~100 ms | > 350 ms |
| order-service | ~2300 ms | > 5000 ms |
| redis-cache | cache hit ~92% | hit ratio < 50% |
