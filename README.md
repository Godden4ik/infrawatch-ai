# InfraWatch AI

AI-powered infrastructure monitoring system using MCP, LangGraph multi-agent orchestration, and GraphRAG for DevOps incident management. Capstone project for PJATK Master's program.

## Architecture

```
(agents and MCPs are yet to be implemented)
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

# 3. Open dashboards
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

## Testing

```bash
# Install test dependencies
pip install -e ".[test]"

# Unit tests (no services needed)
pytest tests/unit/

# Integration tests (requires: docker compose up)
pytest tests/integration/

# End-to-end scenario tests (requires: docker compose up)
pytest tests/e2e/

# All tests
pytest
```

## Repository Layout

```
services/          Simulated microservices (FastAPI + Prometheus metrics)
mcp-servers/       MCP servers: Grafana, Prometheus, Neo4j
agents/            LangGraph agents: Monitor, Analyst, Responder
graph/             Neo4j schema, seed data, GraphRAG pipeline
ui/                Streamlit dashboard
tests/
  unit/            No external dependencies
  integration/     Requires running services
  e2e/             Full stack scenarios with Prometheus validation
scripts/
  inject_anomaly.py   Anomaly injection CLI
prometheus/        prometheus.yml scrape config
grafana/           Provisioned datasources and dashboards
```

## Key Scenarios

| Scenario | Description |
|----------|-------------|
| Anomaly Detection | Real-time cross-service health monitoring |
| Root-Cause Analysis | Trace payment errors through dependency graph |
| Dependency Impact | Blast radius when Redis fails |
| Historical Correlation | Match current patterns to past incidents |
| Capacity Planning | Trend-based scaling recommendations |
