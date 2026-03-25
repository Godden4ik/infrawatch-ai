# InfraWatch AI

AI-powered infrastructure monitoring system using MCP, LangGraph multi-agent orchestration, and GraphRAG for DevOps incident management. Capstone project for PJATK Master's program.

## Architecture

```
Monitor Agent → Analyst Agent → Responder Agent
      ↓               ↓               ↓
Prometheus MCP    Neo4j MCP      Grafana MCP
```

Five simulated microservices emit Prometheus metrics. Agents detect anomalies, trace root causes through a Neo4j dependency graph, and draft remediation actions.

## Quick Start

**Prerequisites:** Docker, Docker Compose, Python 3.12+

```bash
# 1. Start the full stack
docker compose up

# 2. Seed the Neo4j topology graph (first time only)
python graph/seed.py

# 3. Ingest runbooks + incidents into knowledge base (local embeddings, no API key needed)
python graph/ingest.py

# 4. Open dashboards
#   Grafana:    http://localhost:3000  (admin / infrawatch)
#   Prometheus: http://localhost:9090
#   Neo4j:      http://localhost:7474  (neo4j / infrawatch)
```

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

## Anomaly Injection

```bash
# Cascade failure: Redis memory leak → downstream latency → gateway errors
python scripts/inject_anomaly.py cascade

# Inject a specific anomaly type on specific services
python scripts/inject_anomaly.py latency payment-service order-service
python scripts/inject_anomaly.py error api-gateway
python scripts/inject_anomaly.py memory_leak redis-cache

# Clear all anomalies
python scripts/inject_anomaly.py reset
```

**Anomaly types:** `latency`, `error`, `memory_leak`

## MCP Servers

Three FastMCP servers expose infrastructure tools to agents via stdio transport:

| Server | Tools | File |
|--------|-------|------|
| Prometheus | `execute_promql`, `list_metrics`, `get_targets` | `mcp-servers/prometheus_mcp/server.py` |
| Grafana | `list_dashboards`, `get_dashboard`, `get_panel`, `list_alerts` | `mcp-servers/grafana_mcp/server.py` |
| Neo4j | `run_cypher`, `get_service_dependencies`, `get_blast_radius`, `search_runbooks`, `find_similar_incidents`, `get_runbook_for_service`, `search_knowledge_base` | `mcp-servers/neo4j_mcp/server.py` |

Connection URLs are configured via environment variables (defaults to localhost):

| Variable | Default |
|----------|---------|
| `PROMETHEUS_URL` | `http://localhost:9090` |
| `GRAFANA_URL` | `http://localhost:3000` |
| `NEO4J_URI` | `bolt://localhost:7687` |

## Testing

```bash
# Install test dependencies
pip3 install pytest pytest-asyncio httpx "mcp[cli]" neo4j --break-system-packages

# Unit tests (no services needed)
python3 -m pytest tests/unit/

# Integration tests (requires: docker compose up)
python3 -m pytest tests/integration/

# End-to-end scenario tests (requires: docker compose up)
python3 -m pytest tests/e2e/

# All tests
python3 -m pytest
```

## Repository Layout

```
services/              Simulated microservices (FastAPI + Prometheus metrics)
mcp-servers/
  prometheus_mcp/      PromQL queries, metric listing, target health
  grafana_mcp/         Dashboard/panel queries, alert listing
  neo4j_mcp/           Cypher queries, dependency traversal, blast radius
agents/                LangGraph agents: Monitor, Analyst, Responder
graph/                 Neo4j schema, seed, ingestion, GraphRAG retrieval
  data/                Runbooks, incidents, symptoms YAML corpus
ui/                    Streamlit dashboard (TODO)
tests/
  unit/                No external dependencies (26 tests)
  integration/         Requires docker compose up (25 tests)
  e2e/                 Full stack scenarios with Prometheus validation (4 tests)
scripts/
  inject_anomaly.py    Anomaly injection CLI
  evaluate_rag.py      GraphRAG vs Naive RAG comparison
prometheus/            prometheus.yml scrape config
grafana/               Provisioned datasources and dashboards
```

## Key Scenarios

| Scenario | Description |
|----------|-------------|
| Anomaly Detection | Real-time cross-service health monitoring |
| Root-Cause Analysis | Trace payment errors through dependency graph |
| Dependency Impact | Blast radius when Redis fails |
| Historical Correlation | Match current patterns to past incidents |
| Capacity Planning | Trend-based scaling recommendations |
