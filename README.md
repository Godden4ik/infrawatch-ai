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

**Prerequisites:** Docker, Docker Compose, Python 3.12+, Anthropic API key

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

Set `ANTHROPIC_API_KEY` in a `.env` file at the project root before running the pipeline.

## Streamlit Dashboard

| Page | Description |
|------|-------------|
| **Home** | System connectivity status for all services |
| **Service Health** | Real-time Prometheus metrics with SLO indicators |
| **Anomaly Injection** | Inject cascade/latency/error scenarios + trigger pipeline |
| **Pipeline Results** | Monitor → Analyst → Responder output with expandable runbooks/incidents |
| **Dependency Graph** | Interactive Neo4j topology with health-colored nodes |
| **GraphRAG Eval** | Side-by-side GraphRAG vs Naive RAG comparison with charts |

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

Or use the **Run Pipeline** button on the Anomaly Injection page.

The pipeline uses persistent MCP server sessions — the Neo4j server (and its embedding model) loads once per run, not once per tool call.

## MCP Servers

Three FastMCP servers expose infrastructure tools to agents via stdio transport:

| Server | Tools |
|--------|-------|
| Prometheus | `execute_promql`, `list_metrics`, `get_targets` |
| Grafana | `list_dashboards`, `get_dashboard`, `get_panel`, `list_alerts` |
| Neo4j | `run_cypher`, `get_service_dependencies`, `get_blast_radius`, `search_runbooks`, `find_similar_incidents`, `get_runbook_for_service`, `search_knowledge_base` |

## GraphRAG Evaluation

```bash
python scripts/evaluate_rag.py           # Run all 10 queries, print comparison table
python scripts/evaluate_rag.py --json    # Structured JSON output
python scripts/evaluate_rag.py --query 3 # Single query (1-indexed)
```

GraphRAG outperforms Naive RAG on topology-dependent queries (blast radius, cascade failures) by traversing the dependency graph alongside vector search.

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
