"""Configuration — logging setup, MCP server paths, environment loading."""

import logging
import os
from pathlib import Path

from dotenv import load_dotenv

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
