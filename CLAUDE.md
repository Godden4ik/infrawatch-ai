# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**InfraWatch AI** — a capstone project for PJATK Master's program. An AI-powered infrastructure monitoring system that integrates MCP (Model Context Protocol), multi-agent orchestration (LangGraph), and GraphRAG for DevOps incident management.

## Tech Stack

- **Language**: Python
- **AI/Orchestration**: LangChain, LangGraph, OpenAI API
- **Monitoring**: Prometheus, Grafana
- **Graph Database**: Neo4j (topology store + GraphRAG)
- **Infrastructure**: Docker, Docker Compose
- **Frontend**: Streamlit (or React for advanced)
- **Testing**: pytest

## Expected Commands (once implemented)

```bash
docker compose up          # Deploy full stack (Prometheus, Grafana, Neo4j, services)
pytest                     # Run all tests
pytest tests/unit/         # Unit tests only
pytest tests/integration/  # Integration tests
pytest tests/e2e/          # End-to-end scenario tests
```

## Architecture

### Repository Layout

```
services/      # Simulated microservices emitting Prometheus metrics
mcp-servers/   # Three MCP servers: Grafana, Prometheus, Neo4j
agents/        # Three agents: Monitor, Analyst, Responder
graph/         # Neo4j schemas, seed data, GraphRAG pipeline
ui/            # Streamlit dashboard
tests/         # unit/, integration/, e2e/
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

## Development Priorities

Start with Phase 1 (Docker Compose + simulated services) before building the MCP/agent layer. Design MCP tool schemas before implementing agents — the interface contract determines agent capability. Build the anomaly injection framework early so all scenarios can be tested realistically.
