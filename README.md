# InfraWatch AI

AI-powered infrastructure monitoring system using MCP, LangGraph multi-agent orchestration, and GraphRAG for DevOps incident management. Capstone project for PJATK Master's program.

## Architecture

```
  ┌───────────────────────────────────────────────────────────────┐
  │   Next.js 16 Frontend  (port 3001)                            │
  │   Mission Control dark theme · TanStack Query · shadcn/ui     │
  │   Home · Dashboard · Anomaly · Pipeline · Topology · Eval     │
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
pnpm test         # Vitest: 51 unit tests
pnpm build        # Production build
```

## Next.js Frontend

| Page | Route | Description |
|------|-------|-------------|
| **Home** | `/` | System status overview — live health indicators for all services |
| **Dashboard** | `/dashboard` | Real-time P95 latency and error-rate charts per service |
| **Anomaly Injection** | `/anomaly` | Inject cascade / latency / error scenarios; reset |
| **Agent Pipeline** | `/pipeline` | Live SSE stream of Monitor → Analyst → Responder with agent stepper |
| **Topology** | `/topology` | Interactive force-directed dependency graph + blast-radius panel |
| **GraphRAG Eval** | `/evaluation` | Side-by-side GraphRAG vs Naive RAG comparison with Plotly charts |

MSW mock service workers provide realistic API responses in development so the frontend works without a running backend.

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

**2. Open the dashboard** at [http://localhost:3001](http://localhost:3001) — Home page shows green status indicators for all services.

**3. Inject a cascade failure** — go to **Anomaly Injection** and click **💥 Inject Cascade Failure**. This brings Redis down and degrades Payment + Order services.

**4. Wait ~60 seconds** for Prometheus to scrape the new values.

**5. Run the agent pipeline** — go to **Agent Pipeline**, select **Anthropic** in the sidebar, click **▶ Run**. Watch the animated agent stepper and live token stream as Monitor, Analyst, and Responder complete in sequence:
- **Monitor** detects elevated latency and cache hit ratio drop
- **Analyst** traces the root cause through the Neo4j dependency graph
- **Responder** drafts a remediation plan citing runbook IDs (rendered as Markdown)

**6. Show the Topology graph** — go to **Topology**, select `redis-cache` to highlight the blast radius (payment-service and order-service turn amber).

**7. Show the GraphRAG evaluation** — go to **GraphRAG Eval**, click **Run All**. Point out:
- Service Coverage: GraphRAG `1.00` vs Naive RAG `0.00` on cascade queries
- Context Richness: GraphRAG returns structured service relationship fields; Naive RAG returns none
- LLM judge scores are similar — same documents retrieved; topology enrichment is the differentiator

**8. Reset** — return to Anomaly Injection, click **✅ Reset All Services**.

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

Or use the **Run** button on the Agent Pipeline page — the FastAPI backend streams SSE events to the Next.js frontend, rendering each token and tool call in real time.

The pipeline uses persistent MCP server sessions — the Neo4j server (and its embedding model) loads once per run, not once per tool call.

### LLM Backend Selection

Both the agent pipeline and the GraphRAG evaluation support switching backends at runtime:

| Backend | How to use | Notes |
|---------|-----------|-------|
| **Anthropic (default)** | Set `ANTHROPIC_API_KEY` in `.env` | Claude Haiku — reliable structured tool calling |
| **Ollama (local)** | `ollama serve` + model pulled | Selected per-run in the UI sidebar / eval page; set `OLLAMA_URL` if not on localhost |

```bash
# Ollama setup (one-time)
ollama pull qwen2.5:14b   # recommended minimum for tool-calling pipelines
ollama pull llama3.1      # usable for LLM-as-judge only (not reliable for agents)
```

> **Note:** The agent pipeline makes 10+ sequential structured tool calls per run. Models below ~14B parameters frequently hallucinate tool results or ignore tool outputs. The Anthropic backend is recommended for reliable agent behaviour; Ollama is fully functional for the GraphRAG LLM-as-judge (single JSON call per query).

The CLI also accepts a provider flag via the Python API:

```python
import asyncio
from agents import run_pipeline
asyncio.run(run_pipeline(llm_provider="ollama", llm_model="qwen2.5:14b"))
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
cd frontend && pnpm test   # 51 Vitest tests — schemas, utils, components
```

## Repository Layout

```
services/              Simulated microservices (FastAPI + Prometheus metrics)
api_backend/           FastAPI backend — SSE pipeline, anomaly proxy, graph/rag routes
  app.py               FastAPI entry point (port 8090)
  routes/              health, pipeline, anomaly, graph, rag
  Dockerfile
frontend/              Next.js 16 frontend — Mission Control dark theme
  src/app/             App Router pages (home, dashboard, anomaly, pipeline, topology, evaluation)
  src/services/        TanStack Query service layer with Zod schemas
  src/mocks/           MSW mock handlers + fake data fixtures
  src/__tests__/       Vitest tests (51)
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
