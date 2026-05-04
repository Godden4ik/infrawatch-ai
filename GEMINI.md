# InfraWatch AI: Project Context & Guidelines

InfraWatch AI is an advanced, AI-powered infrastructure monitoring platform. It leverages the Model Context Protocol (MCP) to bridge the gap between AI agents and infrastructure tools like Prometheus, Grafana, and Neo4j. The system uses a multi-agent orchestration pattern (LangGraph) and GraphRAG to provide intelligent anomaly detection, root-cause analysis, and incident response.

## 🏗️ Architecture Overview

The system follows a multi-layered architecture:

1.  **Frontend**: Next.js 16 application (port 3001) providing a "Mission Control" dashboard.
2.  **API Backend**: FastAPI application (port 8090) acting as the control plane and streaming agent events via SSE.
3.  **Agent Pipeline**: A LangGraph-based orchestration of three specialized agents:
    *   **Monitor Agent**: Detects anomalies by querying Prometheus and Grafana.
    *   **Analyst Agent**: Identifies root causes by traversing the Neo4j dependency graph and historical incidents.
    *   **Responder Agent**: Drafts remediation plans based on runbooks and GraphRAG context.
4.  **MCP Servers**: Three FastMCP servers (Prometheus, Grafana, Neo4j) that expose infrastructure tools as LLM-ready functions.
5.  **Infrastructure**: Dockerized stack including Prometheus (metrics), Grafana (visualization), and Neo4j (topology & GraphRAG).
6.  **Simulated Microservices**: Five services (api-gateway, payment, user, order, redis) that emit metrics and support fault injection.

## 🚀 Key Commands

### Environment Setup
*   `cp .env.example .env` (Add your `ANTHROPIC_API_KEY`)
*   `uv sync` (Install Python dependencies)
*   `cd frontend && pnpm install` (Install frontend dependencies)

### Running the Stack
*   `docker compose up` (Start the entire system)
*   `python graph/seed.py` (Initialize Neo4j topology graph)
*   `python graph/ingest.py` (Embed runbooks and incidents into Neo4j)
*   `cd frontend && pnpm dev` (Run frontend in development mode with MSW mocks)

### Testing & Quality
*   `pytest` (Run all Python tests: unit, integration, and e2e)
*   `cd frontend && pnpm test` (Run Vitest frontend tests)
*   `ruff check .` (Python linting)
*   `pyright` (Python type checking)

### Utilities
*   `python scripts/inject_anomaly.py <scenario>` (Inject faults: `cascade`, `latency`, `error`, `reset`)
*   `python scripts/evaluate_rag.py` (Run GraphRAG vs Naive RAG benchmark)

## 📁 Repository Structure

*   `agents/`: LangGraph definitions, agent nodes, and pipeline state.
*   `api_backend/`: FastAPI routes (`health`, `pipeline`, `graph`, `anomaly`, `rag`).
*   `frontend/`: Next.js source code, components, and mock service workers.
*   `mcp-servers/`: Custom FastMCP implementations for infrastructure tools.
*   `graph/`: Neo4j seeding, ingestion, and GraphRAG/Naive RAG retrieval logic.
*   `services/`: Dockerized Python microservices for metric simulation.
*   `ui/`: Streamlit fallback dashboard.
*   `scripts/`: Automation for anomaly injection and RAG evaluation.

## 🛠️ Development Conventions

### Python (Backend & Agents)
*   **Dependency Management**: Use `uv` exclusively.
*   **Linting/Typing**: Adhere to `ruff` and `pyright` standards as configured in `pyproject.toml`.
*   **Agents**: New agent capabilities should be implemented as MCP tools first, then integrated into the LangGraph pipeline in `agents/graph.py`.
*   **Async**: Prioritize `async/await` for all I/O bound operations (API, Neo4j, MCP).

### Frontend (Next.js)
*   **Theme**: Dark mode "Mission Control" aesthetic using Tailwind CSS and shadcn/ui.
*   **Data Fetching**: Use TanStack Query for API interactions.
*   **Mocks**: Always maintain MSW handlers in `src/mocks` for backend-less development.
*   **State**: Leverage Zod for schema validation and URL-based state via `nuqs` where appropriate.

### Infrastructure & Data
*   **Graph Schema**: Neo4j is the source of truth for topology. See `graph/seed.py` for relationship types (`DEPENDS_ON`, `CALLS`, `ROUTES_TO`).
*   **GraphRAG**: Context enrichment happens in `graph/retrieval.py` by combining vector search results with neighbor-node data.

## 🚨 Security
*   Never commit `.env` files or hardcode API keys.
*   Use the `ANTHROPIC_API_KEY` environment variable for the primary agent LLM.
*   Docker networks are isolated; use service names for internal communication.
