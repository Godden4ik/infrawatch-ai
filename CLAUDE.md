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
- **Frontend**: Streamlit
- **Testing**: pytest, pytest-asyncio, httpx

## Commands

```bash
docker compose up          # Deploy full stack (Prometheus, Grafana, Neo4j, services)
python graph/seed.py       # Seed Neo4j topology (run once after compose up)
python graph/ingest.py     # Ingest runbooks + incidents into Neo4j (local embeddings)

streamlit run ui/app.py    # Launch Streamlit dashboard on http://localhost:8501

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
python scripts/evaluate_rag.py --provider ollama --ollama-model qwen2.5:14b  # Ollama judge

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
services/      # Simulated microservices emitting Prometheus metrics  ✅ DONE
mcp-servers/   # Three MCP servers: Grafana, Prometheus, Neo4j        ✅ DONE
agents/        # LangGraph pipeline: Monitor → Analyst → Responder    ✅ DONE
graph/         # Neo4j schemas, seed data, GraphRAG pipeline          ✅ DONE
ui/            # Streamlit dashboard (5 pages)                        ✅ DONE
tests/         # unit/ ✅  integration/ ✅  e2e/ ✅
scripts/       # inject_anomaly.py, evaluate_rag.py                   ✅ DONE
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

**LLM backend selection:**
- `llm_provider="anthropic"` (default) — `ChatAnthropic` via Anthropic API
- `llm_provider="ollama"` + `llm_model="<name>"` — `ChatOllama` via local Ollama instance on `localhost:11434`
- Provider and model are threaded through `run_pipeline` / `stream_pipeline` → `build_graph` → each node via `functools.partial`
- Ollama requires ≥14B model for reliable structured tool calling; 7B models hallucinate tool results in multi-step pipelines

### MCP Servers

Each MCP server exposes domain-specific tools to agents:

| Server | Tools |
|--------|-------|
| Prometheus MCP (`mcp-servers/prometheus_mcp/server.py`) | `execute_promql`, `list_metrics`, `get_targets` |
| Grafana MCP (`mcp-servers/grafana_mcp/server.py`) | `list_dashboards`, `get_dashboard`, `get_panel`, `list_alerts` |
| Neo4j MCP (`mcp-servers/neo4j_mcp/server.py`) | `run_cypher`, `get_service_dependencies`, `get_blast_radius`, `search_runbooks`, `find_similar_incidents`, `get_runbook_for_service`, `search_knowledge_base` |

### Streamlit UI

Five pages under `ui/pages/`, shared components in `ui/components/`:

| Page | File | Key behaviour |
|------|------|---------------|
| Home | `app.py` | Connectivity checks for all services |
| Service Health | `1_Dashboard.py` | Live Prometheus metrics, auto-refresh |
| Anomaly Injection | `2_Anomaly_Injection.py` | Preset + manual injection, pipeline trigger |
| Pipeline Results | `3_Pipeline_Results.py` | Live token + tool-call streaming per agent; LLM provider selector (Anthropic/Ollama) in sidebar; runbooks/incidents fetched from Neo4j by ID |
| Dependency Graph | `4_Dependency_Graph.py` | pyvis interactive graph, blast-radius highlighting |
| GraphRAG Eval | `5_GraphRAG_Eval.py` | Side-by-side comparison + Plotly bar charts; LLM-as-judge provider selector (Anthropic/Ollama + model name input) |

### GraphRAG vs Naive RAG

A key deliverable is demonstrating GraphRAG superiority for topology-dependent queries (e.g., blast radius analysis). Runbooks and incident reports are ingested into Neo4j alongside the infrastructure topology graph. The `sentence-transformers` model generates embeddings; the Anthropic API is **not** used for embeddings.

**LLM-as-judge** (`scripts/evaluate_rag.py` / `5_GraphRAG_Eval.py`):
- Scores retrieved content on `content_relevance` and `actionability` (1–10 integers) per query
- Supports `provider="anthropic"` (Claude Haiku via async SDK) and `provider="ollama"` (local REST call to `localhost:11434/api/chat` via `asyncio.to_thread`)
- Both GraphRAG and Naive RAG retrieve the same documents (high Jaccard content overlap); the judge scores are expected to be similar — the structural metrics (service coverage, context richness) are where GraphRAG wins
- CLI flags: `--provider anthropic|ollama`, `--ollama-model <name>`

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
| Streamlit UI | 8501 |
