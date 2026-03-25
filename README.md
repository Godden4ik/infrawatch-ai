# InfraWatch AI

AI-powered infrastructure monitoring system using MCP, LangGraph multi-agent orchestration, and GraphRAG for DevOps incident management. Capstone project for PJATK Master's program.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │         Streamlit Dashboard          │
                    │  Health · Injection · Results · RAG  │
                    └──────────────┬──────────────────────┘
                                   │
          ┌────────────────────────▼────────────────────────┐
          │              LangGraph Agent Pipeline            │
          │   Monitor Agent → Analyst Agent → Responder Agent│
          └────┬──────────────────┬──────────────────┬──────┘
               │                  │                  │
        Prometheus MCP        Neo4j MCP          Grafana MCP
               │                  │
        Prometheus ←──── 5 microservices     Neo4j GraphRAG
         (metrics)                            (runbooks + topology)
```

Five simulated microservices emit Prometheus metrics. Agents detect anomalies, trace root causes through a Neo4j dependency graph enriched with runbooks and historical incidents, and draft remediation plans.

## Quick Start

**Prerequisites:** Docker, Docker Compose, Python 3.12+, Anthropic API key (or Ollama for local inference)

```bash
# 1. Start the full stack
docker compose up

# 2. Seed the Neo4j topology graph (first time only)
python graph/seed.py

# 3. Ingest runbooks + incidents into knowledge base (local embeddings)
python graph/ingest.py

# 4. Launch the Streamlit dashboard
streamlit run ui/app.py
# → http://localhost:8501

# Optional: open infrastructure dashboards directly
#   Grafana:    http://localhost:3000  (admin / infrawatch)
#   Prometheus: http://localhost:9090
#   Neo4j:      http://localhost:7474  (neo4j / infrawatch)
```

Copy `.env.example` to `.env` and fill in your Anthropic API key — all other values default to the Docker Compose stack and can be left as-is:

```bash
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
```

## Streamlit Dashboard

| Page | Description |
|------|-------------|
| **Home** | System connectivity status for all services |
| **Service Health** | Real-time Prometheus metrics with SLO indicators |
| **Anomaly Injection** | Inject cascade/latency/error scenarios + trigger pipeline |
| **Pipeline Results** | Live-streaming Monitor → Analyst → Responder output; token stream + tool call events per agent; expandable runbooks/incidents fetched from Neo4j |
| **Dependency Graph** | Interactive Neo4j topology with health-colored nodes |
| **GraphRAG Eval** | Side-by-side GraphRAG vs Naive RAG comparison with Plotly charts; LLM-as-judge scoring via Anthropic or Ollama |

## Service Ports

| Service | Port |
|---------|------|
| api-gateway | 8080 |
| payment-service | 8001 |
| user-service | 8002 |
| order-service | 8003 |
| redis-cache | 8004 |
| Prometheus | 9090 |
| Grafana | 3000 |
| Neo4j HTTP | 7474 |
| Neo4j Bolt | 7687 |
| Streamlit UI | 8501 |

## Demo Walkthrough

The full demo runs in under 5 minutes once the stack is up. Follow this sequence:

**1. Start the stack and seed data** (first time only)
```bash
docker compose up -d
python graph/seed.py    # loads Neo4j topology
python graph/ingest.py  # embeds runbooks + incidents
```

**2. Open the dashboard** at [http://localhost:8501](http://localhost:8501) — Home page shows green connectivity for all services.

**3. Inject a cascade failure** — go to **Anomaly Injection** and click **💥 Inject Cascade Failure**. This takes Redis down and degrades Payment + Order services.

**4. Wait ~60 seconds** for Prometheus to scrape the new values.

**5. Run the agent pipeline** — go to **Pipeline Results**, select **Anthropic** in the sidebar, click **▶ Run Pipeline**. Watch the live token stream and tool calls as each agent runs:
- **Monitor** detects elevated latency and cache hit ratio drop
- **Analyst** traces the root cause through the Neo4j dependency graph
- **Responder** drafts a remediation plan citing runbook IDs

**6. Show the GraphRAG evaluation** — go to **GraphRAG Eval**, click **Run All**. Point out:
- Service Coverage: GraphRAG `1.00` vs Naive RAG `0.00` on cascade queries
- Context Richness: GraphRAG returns structured service relationship fields; Naive RAG returns none
- LLM judge scores are similar for both — same documents retrieved, topology enrichment is the differentiator

**7. Reset** — go back to Anomaly Injection, click **✅ Reset All Services**.

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

Or use the **Run Pipeline** button on the Pipeline Results page, which streams live token output and tool call events per agent.

The pipeline uses persistent MCP server sessions — the Neo4j server (and its embedding model) loads once per run, not once per tool call.

### LLM Backend Selection

Both the agent pipeline and the GraphRAG evaluation support switching between backends at runtime:

| Backend | How to use | Notes |
|---------|-----------|-------|
| **Anthropic (default)** | Set `ANTHROPIC_API_KEY` in `.env` | Claude Haiku — reliable structured tool calling |
| **Ollama (local)** | `ollama serve` + model pulled | Selected per-run in the UI sidebar / eval page |

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
pytest tests/unit/         # No external dependencies
pytest tests/integration/  # Requires docker compose up
pytest tests/e2e/          # Full stack with Prometheus validation
pytest                     # All tests
```

## Repository Layout

```
services/              Simulated microservices (FastAPI + Prometheus metrics)
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
ui/
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
prometheus/            prometheus.yml scrape config
grafana/               Provisioned datasources and dashboards
```

## Healthy Baselines

| Service | P95 Latency | Anomaly Threshold |
|---------|-------------|-------------------|
| api-gateway | ~100 ms | > 400 ms |
| payment-service | ~930 ms | > 2000 ms |
| user-service | ~100 ms | > 350 ms |
| order-service | ~2300 ms | > 5000 ms |
| redis-cache | cache hit ~92% | hit ratio < 50% |
