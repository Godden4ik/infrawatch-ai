"""Configuration — LLM factory, MCP server paths, environment loading."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv
from langchain_anthropic import ChatAnthropic

load_dotenv()


def setup_logging(level: int = logging.INFO) -> None:
    """Configure pipeline logging. Call once before run_pipeline()."""
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
        datefmt="%H:%M:%S",
        force=True,
    )
    # Silence noisy third-party loggers
    for noisy in ("httpx", "httpcore", "mcp", "anthropic"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

PROJECT_ROOT = Path(__file__).resolve().parent.parent

_subprocess_env = os.environ.copy()

MCP_SERVERS = {
    "prometheus": {
        "command": "python3",
        "args": [str(PROJECT_ROOT / "mcp-servers" / "prometheus_mcp" / "server.py")],
        "transport": "stdio",
        "env": _subprocess_env,
    },
    "grafana": {
        "command": "python3",
        "args": [str(PROJECT_ROOT / "mcp-servers" / "grafana_mcp" / "server.py")],
        "transport": "stdio",
        "env": _subprocess_env,
    },
    "neo4j": {
        "command": "python3",
        "args": [str(PROJECT_ROOT / "mcp-servers" / "neo4j_mcp" / "server.py")],
        "transport": "stdio",
        "env": _subprocess_env,
    },
}

ANTHROPIC_DEFAULT_MODEL = "claude-haiku-4-5-20251001"
OLLAMA_DEFAULT_MODEL = "llama3.1"


def get_llm(temperature: float = 0.0, provider: str = "anthropic", model: str | None = None):
    """Return an LLM instance for agent use.

    provider: "anthropic" (default) or "ollama"
    model:    override the default model for the chosen provider
    """
    if provider == "ollama":
        from langchain_ollama import ChatOllama
        base_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        return ChatOllama(
            model=model or OLLAMA_DEFAULT_MODEL,
            base_url=base_url,
            temperature=temperature,
        )
    return ChatAnthropic(
        model=model or ANTHROPIC_DEFAULT_MODEL,
        temperature=temperature,
        api_key=os.getenv("ANTHROPIC_API_KEY"),
    )
