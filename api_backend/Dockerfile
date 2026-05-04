FROM python:3.12-slim

WORKDIR /project

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

# Copy dependency files first for caching
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

# Copy source
COPY agents/ agents/
COPY graph/ graph/
COPY mcp-servers/ mcp-servers/
COPY api_backend/ api_backend/
COPY scripts/ scripts/
COPY scenarios/ scenarios/

ENV PYTHONPATH=/project

EXPOSE 8090

CMD ["uv", "run", "uvicorn", "api_backend.app:app", "--host", "0.0.0.0", "--port", "8090"]
