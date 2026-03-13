# 🎓 Capstone Project: InfraWatch AI

## What You'll Build
An AI infrastructure monitoring system that demonstrates MCP integration, multi-agent orchestration, and GraphRAG advantages over traditional RAG for DevOps queries. You'll solve a real operations problem: intelligently detecting anomalies, analyzing root causes, and responding to incidents across microservices through Grafana dashboards.

## Learning Goals
1. Implement MCP servers and clients with LangChain
2. Build multi-agent systems with specialized roles
3. Deploy containerized AI services with Docker Compose
4. Compare GraphRAG vs traditional RAG for infrastructure reasoning

## Project Overview

### Problem
Operations teams struggle to manage cloud infrastructure because:
- Dashboard fatigue — dozens of Grafana panels, no unified reasoning across them
- Alert noise — hundreds of alerts per day, most low-priority, masking real incidents
- Need to answer complex questions like "What's causing high latency on the payment service?"

### Solution
Build a dockerized multi-agent MCP system that:
- Connects to Grafana and Prometheus via MCP tools, giving AI agents real-time access to metrics
- Uses specialized agents (Monitor, Analyst, Responder) to detect, analyze, and respond to incidents
- Models infrastructure topology in Neo4j for GraphRAG-powered root-cause analysis

## Project Phases (10 weeks)

### Phase 1: Foundation (Weeks 1-2)
**Goal**: Setup and basic infrastructure

**Tasks:**
- Setup Docker Compose with Prometheus, Grafana, and Neo4j
- Build 3-5 simulated microservices with Prometheus metrics endpoints
- Create anomaly injection scripts (CPU spikes, memory leaks, latency)
- Populate Neo4j with infrastructure topology graph

**Deliverables:**
- One-command Docker Compose deployment
- 5 simulated services emitting metrics
- Pre-configured Grafana dashboards

### Phase 2: MCP & Agents (Weeks 3-5)
**Goal**: Build the MCP layer and agent pipeline

**Tasks:**
- Implement MCP Server for Grafana (query dashboards, read panels, list alerts)
- Implement MCP Server for Prometheus (execute PromQL queries, fetch ranges)
- Implement MCP Server for Neo4j (run Cypher queries, traverse dependencies)
- Build 3 agents: Monitor (detects anomalies), Analyst (finds root cause), Responder (drafts actions)
- Orchestrate agents with LangGraph (Monitor → Analyst → Responder)

**Deliverables:**
- 3 MCP servers with documented tool schemas
- 3 functional agents connected via MCP client
- End-to-end pipeline: anomaly → analysis → response

### Phase 3: Intelligence & Comparison (Weeks 6-8)
**Goal**: Show GraphRAG advantages

**Tasks:**
- Build GraphRAG pipeline: ingest runbooks and incident reports into Neo4j
- Create comparison with Naive RAG baseline
- Implement natural language query interface
- Build simple monitoring dashboard

**Key Queries to Support:**
- "What is causing high latency on the payment service?"
- "Which services are affected if Redis goes down?"
- "Show me all incidents related to memory pressure this week."
- "What is the root cause of the error rate spike?"

**Deliverables:**
- Natural language query interface
- GraphRAG vs Naive RAG comparison
- Monitoring intelligence dashboard

### Phase 4: Evaluation (Weeks 9-10)
**Goal**: Document and present

**Tasks:**
- Security hardening (API key management, Docker network isolation)
- Testing (pytest, integration tests, scenario validation)
- Performance benchmarking
- Create documentation
- Record demonstration video
- Final presentation

## Success Criteria

### Minimum Requirements
- [ ] Deploy full system with `docker compose up`
- [ ] 3 MCP servers exposing Grafana, Prometheus, and Neo4j as AI tools
- [ ] Multi-agent pipeline with LangGraph orchestration
- [ ] Answer 10 operator queries correctly
- [ ] Demonstrate GraphRAG superiority on topology-dependent queries
- [ ] Complete documentation and demo

### Advanced Features (Bonus)
- [ ] Ollama integration for local/self-hosted deployment
- [ ] Auto-remediation (agent triggers container scaling)
- [ ] Predictive alerting (detect trends before thresholds breach)
- [ ] Live Grafana plugin showing AI insights in real-time

## Assessment (100 points)

| Component | Weight | Description |
|-----------|--------|-------------|
| **Technical Implementation** | 40% | Code quality, Docker architecture, MCP design |
| **Graph Design** | 20% | Schema design, query efficiency, GraphRAG pipeline |
| **Agent Orchestration** | 20% | Agent specialization, LangGraph quality, MCP tools |
| **Documentation** | 10% | Technical docs, user guide |
| **Presentation** | 10% | Demo, value proposition, communication |

## Monitoring Scenarios to Solve
Your system must handle these real operational queries:

1. **Anomaly Detection**: "Is anything abnormal happening across our services right now?"
2. **Root-Cause Analysis**: "Payment service has high error rates — what's the root cause?"
3. **Dependency Impact**: "If Redis goes down, what's the blast radius?"
4. **Historical Correlation**: "Has this CPU + memory pattern happened before? What fixed it?"
5. **Capacity Planning**: "When will we need to scale the database based on current trends?"

## Getting Started

### Repository Structure
Start with this layout as your foundation:
- `services/` — Simulated microservices with Prometheus metrics
- `mcp-servers/` — Grafana, Prometheus, Neo4j MCP servers
- `agents/` — Monitor, Analyst, Responder agents
- `graph/` — Neo4j schemas, seed data, GraphRAG pipeline
- `ui/` — Streamlit dashboard
- `tests/` — Unit, integration, e2e tests

### Tech Stack
- **Required**: Python, Neo4j, LangChain, OpenAI API, Docker
- **Frontend**: Streamlit (simple) or React (advanced)
- **Testing**: pytest for validation

### Extension Areas
Extend the base implementation to handle:
- Additional MCP servers (logs, deployment pipelines)
- More simulated services and complex topologies
- Predictive anomaly detection
- Auto-remediation via Docker API
- Ollama for local model inference

## Resources & Support
- **MCP Docs**: modelcontextprotocol.io
- **Documentation**: Neo4j Graph Academy, LangChain docs, Grafana HTTP API
- **Timeline**: 10 weeks with milestone reviews

## Success Tips
1. **Start with Docker Compose on day one** — get the full stack running, then iterate
2. **Design MCP tool schemas early** — agree on the interface contract before building agents
3. **Focus on the operator experience** — this isn't just a technical exercise
4. **Document your GraphRAG advantages** — show why it beats traditional RAG
5. **Test with realistic scenarios** — build the anomaly injection framework early

---

**Goal**: Build a professional AI monitoring system that solves real DevOps problems while demonstrating MCP, multi-agent orchestration, and GraphRAG techniques. This will be a strong portfolio piece showing your ability to apply AI to practical infrastructure challenges.
