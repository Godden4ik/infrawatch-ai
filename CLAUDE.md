# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**InfraWatch AI** — a capstone project for PJATK Master's program. An AI-powered infrastructure monitoring system that integrates MCP (Model Context Protocol), multi-agent orchestration (LangGraph), and GraphRAG for DevOps incident management.

## Tech Stack

- **Language**: Python 3.12+
- **AI/Orchestration**: LangChain, LangGraph, OpenAI API
- **Monitoring**: Prometheus, Grafana
- **Graph Database**: Neo4j (topology store + GraphRAG)
- **Infrastructure**: Docker, Docker Compose
- **Frontend**: Streamlit (or React for advanced)
- **Testing**: pytest, pytest-asyncio, httpx

## Commands

```bash
docker compose up          # Deploy full stack (Prometheus, Grafana, Neo4j, services)
python graph/seed.py       # Seed Neo4j topology (run once after compose up)

pytest tests/unit/         # Unit tests — no services needed
pytest tests/integration/  # Integration tests — requires docker compose up
pytest tests/e2e/          # End-to-end scenario tests — requires docker compose up
pytest                     # All tests

python scripts/inject_anomaly.py cascade        # Inject cascade failure scenario
python scripts/inject_anomaly.py reset          # Clear all anomalies
python scripts/inject_anomaly.py latency payment-service  # Inject on specific service
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
mcp-servers/   # Three MCP servers: Grafana, Prometheus, Neo4j        🔲 TODO
agents/        # Three agents: Monitor, Analyst, Responder             🔲 TODO
graph/         # Neo4j schemas, seed data, GraphRAG pipeline          ✅ DONE (seed)
ui/            # Streamlit dashboard                                   🔲 TODO
tests/         # unit/ ✅  integration/ ✅  e2e/ ✅
scripts/       # inject_anomaly.py — anomaly injection CLI             ✅ DONE
```

### Agent Pipeline

The core flow is a LangGraph-orchestrated pipeline:

```
Monitor Agent → Analyst Agent → Responder Agent
```

- **Monitor**: Polls Prometheus/Grafana via MCP, detects anomalies
- **Analyst**: Queries Neo4j graph topology to find root causes
- **Responder**: Drafts remediation actions based on analysis

### MCP Servers

Each MCP server exposes domain-specific tools to agents:

| Server | Tools |
|--------|-------|
| Grafana MCP | query dashboards, read panels, list alerts |
| Prometheus MCP | execute PromQL, fetch time ranges |
| Neo4j MCP | run Cypher queries, traverse service dependencies |

### GraphRAG vs Naive RAG

A key deliverable is demonstrating GraphRAG superiority for topology-dependent queries (e.g., blast radius analysis). Runbooks and incident reports are ingested into Neo4j alongside the infrastructure topology graph.

## Phase Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 1 | Docker Compose + simulated services + tests | ✅ Complete |
| Phase 2 | MCP servers (Grafana, Prometheus, Neo4j) | 🔲 Next |
| Phase 3 | LangGraph agent pipeline | 🔲 TODO |
| Phase 4 | GraphRAG pipeline + runbook ingestion | 🔲 TODO |
| Phase 5 | Streamlit UI + demo scenarios | 🔲 TODO |

## Key Scenarios to Implement

1. Anomaly Detection — real-time cross-service health check
2. Root-Cause Analysis — trace payment service errors through dependency graph
3. Dependency Impact — blast radius when a node (e.g., Redis) fails
4. Historical Correlation — match current patterns to past incidents
5. Capacity Planning — trend-based scaling recommendations

## Assessment Weights

| Component | Weight |
|-----------|--------|
| Technical Implementation (code, Docker, MCP design) | 40% |
| Graph Design (Neo4j schema, query efficiency, GraphRAG) | 20% |
| Agent Orchestration (LangGraph, agent specialization) | 20% |
| Documentation | 10% |
| Presentation & Demo | 10% |

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
