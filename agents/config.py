"""Configuration — LLM factory, MCP server paths, environment loading."""

import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent

MCP_SERVERS = {
    "prometheus": {
        "command": "python3",
        "args": [str(PROJECT_ROOT / "mcp-servers" / "prometheus_mcp" / "server.py")],
        "transport": "stdio",
    },
    "grafana": {
        "command": "python3",
        "args": [str(PROJECT_ROOT / "mcp-servers" / "grafana_mcp" / "server.py")],
        "transport": "stdio",
    },
    "neo4j": {
        "command": "python3",
        "args": [str(PROJECT_ROOT / "mcp-servers" / "neo4j_mcp" / "server.py")],
        "transport": "stdio",
    },
}


def get_llm(temperature: float = 0.0) -> ChatAnthropic:
    """Return a ChatAnthropic instance for agent use."""
    return ChatAnthropic(
        model="claude-sonnet-4-20250514",
        temperature=temperature,
        api_key=os.getenv("ANTHROPIC_API_KEY"),
    )
