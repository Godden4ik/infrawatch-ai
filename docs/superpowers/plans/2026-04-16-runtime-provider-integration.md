# Runtime Provider Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hardcoded Anthropic/Ollama binary choice with a pluggable provider registry — any LangChain-compatible provider works at runtime with one config entry. Frontend gets brand icons, runtime API key input, health checks, and toast notifications.

**Architecture:** Backend provider registry (`agents/providers.py`) maps provider IDs to LangChain classes via dynamic import. FastAPI exposes `/providers/list` and `/providers/{id}/health`. Frontend `<ProviderSelector>` component with `@lobehub/icons-react` icons is shared across pipeline and evaluation pages. API keys stored in `sessionStorage`, sent per-request.

**Tech Stack:** Python 3.12, LangChain (langchain-anthropic, langchain-openai, langchain-google-genai, langchain-ollama), LangGraph, FastAPI, Next.js 16, React 19, @tanstack/react-query, @lobehub/icons-react, lucide-animated, Base UI Toast, Zod

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `agents/providers.py` | Provider registry dict + `get_llm()` factory with dynamic import + `_build_provider_kwargs()` adapter |
| `api_backend/routes/providers.py` | `GET /providers/list`, `GET /providers/{id}/health` endpoints |
| `frontend/src/app/api/providers/[...path]/route.ts` | Next.js proxy for `/providers/*` → backend |
| `frontend/src/services/providers/schema.ts` | Zod schemas for provider list + health responses |
| `frontend/src/services/providers/query-options.ts` | React Query options for provider list + health |
| `frontend/src/lib/provider-display.ts` | Icon/color/description map keyed by provider ID |
| `frontend/src/lib/provider-keys.ts` | `sessionStorage` get/store/clear per-provider key |
| `frontend/src/components/provider-selector.tsx` | Shared provider pills + model dropdown + key input + health check |
| `frontend/src/components/ui/toast-provider.tsx` | Base UI Toast.Provider wrapper |
| `frontend/src/components/ui/toast.tsx` | Styled toast variants (success/error/info) |
| `frontend/src/hooks/use-toast.ts` | Imperative toast API |
| `tests/unit/test_agents/test_providers.py` | Unit tests for new provider registry + get_llm() |
| `tests/unit/test_api/test_providers_route.py` | Unit tests for provider API endpoints |

### Modified Files

| File | Change |
|------|--------|
| `agents/config.py` | Remove `get_llm()`, `ANTHROPIC_DEFAULT_MODEL`, `OLLAMA_DEFAULT_MODEL` |
| `agents/monitor.py` | Import `get_llm` from `providers`, add `api_key` param |
| `agents/analyst.py` | Same |
| `agents/responder.py` | Same |
| `agents/graph.py` | Thread `api_key` through `partial()` |
| `agents/__init__.py` | Accept + pass `api_key` in `run_pipeline()` / `stream_pipeline()` |
| `agents/llm_utils.py` | Fix type hint `ChatAnthropic` → `BaseChatModel` |
| `api_backend/app.py` | CORS from env, mount `/providers`, remove `/models` |
| `api_backend/routes/pipeline.py` | Add `api_key: str | None = Field(None, repr=False)` |
| `api_backend/routes/rag.py` | Add `judge_provider`, `judge_model`, `judge_api_key` fields |
| `scripts/evaluate_rag.py` | Replace raw Anthropic SDK with `get_llm()` from registry |
| `tests/unit/test_agents/test_config.py` | Update imports — `get_llm` moved to `providers` |
| `frontend/src/app/pipeline/_components/pipeline-controls.tsx` | Replace hardcoded providers with `<ProviderSelector>` |
| `frontend/src/app/evaluation/_components/eval-form.tsx` | Add `<ProviderSelector>` for judge |
| `frontend/src/services/rag/actions.ts` | Pass judge provider/model/key params |
| `frontend/src/app/layout.tsx` | Wrap with `<ToastProvider>` |
| `frontend/src/services/pipeline/use-pipeline.ts` | Send `api_key` in request body |
| `frontend/package.json` | Add `@lobehub/icons-react`, `lucide-animated` |
| `pyproject.toml` | Name → `infrawatch-ai`, add `langchain-openai`, `langchain-google-genai` |
| `docker-compose.yml` | Remove `streamlit-ui` service block |
| `.gitignore` | Add `.DS_Store`, `.tmp/` |

### Deleted

| File | Why |
|------|-----|
| `api_backend/routes/models.py` | Replaced by `providers.py` |
| `frontend/src/services/models/schema.ts` | Replaced by `providers/schema.ts` |
| `frontend/src/services/models/query-options.ts` | Replaced by `providers/query-options.ts` |
| `frontend/src/app/api/models/[...path]/route.ts` | Replaced by `providers/[...path]/route.ts` |

---

## Task 1: Cleanup — gitignore, project name, Streamlit removal

**Files:**
- Modify: `.gitignore`
- Modify: `pyproject.toml:2`
- Modify: `docker-compose.yml:87-101`

- [ ] **Step 1: Add `.DS_Store` and `.tmp/` to `.gitignore`**

Append to the end of `.gitignore`:

```
# macOS
.DS_Store

# Temp files
.tmp/
```

- [ ] **Step 2: Fix project name in `pyproject.toml`**

Change line 2 from:
```toml
name = "teg"
```
to:
```toml
name = "infrawatch-ai"
```

- [ ] **Step 3: Remove Streamlit service from `docker-compose.yml`**

Delete lines 87-101 (the entire `streamlit-ui:` service block):
```yaml
  streamlit-ui:
    build: ui
    ports:
      - "8501:8501"
    networks:
      - infrawatch
    depends_on:
      - prometheus
      - grafana
      - neo4j
    environment:
      - PROMETHEUS_URL=http://prometheus:9090
      - NEO4J_URI=bolt://neo4j:7687
      - NEO4J_USER=neo4j
      - NEO4J_PASSWORD=infrawatch
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore pyproject.toml docker-compose.yml
git commit -m "chore: fix project name, remove streamlit from compose, update gitignore"
```

---

## Task 2: Backend Provider Registry

**Files:**
- Create: `agents/providers.py`
- Create: `tests/unit/test_agents/test_providers.py`
- Modify: `agents/config.py`

- [ ] **Step 1: Write failing tests for provider registry**

Create `tests/unit/test_agents/test_providers.py`:

```python
"""Unit tests for agents/providers.py — provider registry and get_llm factory."""

import sys
import types
from unittest.mock import patch

import pytest


def _make_mock_module(class_name: str):
    """Create a mock LangChain provider module with a chat model class."""
    mod = types.ModuleType(f"mock_{class_name}")

    class MockChat:
        def __init__(self, **kwargs):
            for k, v in kwargs.items():
                setattr(self, k, v)

    MockChat.__name__ = class_name
    MockChat.__qualname__ = class_name
    setattr(mod, class_name, MockChat)
    return mod


class TestProviderRegistry:
    def test_registry_has_anthropic(self):
        from agents.providers import PROVIDER_REGISTRY
        assert "anthropic" in PROVIDER_REGISTRY
        assert PROVIDER_REGISTRY["anthropic"]["module"] == "langchain_anthropic"

    def test_registry_has_openai(self):
        from agents.providers import PROVIDER_REGISTRY
        assert "openai" in PROVIDER_REGISTRY
        assert PROVIDER_REGISTRY["openai"]["module"] == "langchain_openai"

    def test_registry_has_google(self):
        from agents.providers import PROVIDER_REGISTRY
        assert "google" in PROVIDER_REGISTRY
        assert PROVIDER_REGISTRY["google"]["module"] == "langchain_google_genai"

    def test_registry_has_ollama(self):
        from agents.providers import PROVIDER_REGISTRY
        assert "ollama" in PROVIDER_REGISTRY
        assert PROVIDER_REGISTRY["ollama"]["key_env"] is None

    def test_all_entries_have_required_keys(self):
        from agents.providers import PROVIDER_REGISTRY
        required = {"name", "module", "class", "key_env", "default_model", "models"}
        for pid, entry in PROVIDER_REGISTRY.items():
            missing = required - set(entry.keys())
            assert not missing, f"Provider '{pid}' missing keys: {missing}"


class TestGetLlm:
    def test_returns_anthropic_by_default(self):
        from agents.providers import get_llm
        llm = get_llm(provider="anthropic")
        assert type(llm).__name__ == "ChatAnthropic"

    def test_anthropic_model_override(self):
        from agents.providers import get_llm
        llm = get_llm(provider="anthropic", model="claude-opus-4-6")
        assert llm.model == "claude-opus-4-6"

    def test_anthropic_uses_default_model(self):
        from agents.providers import PROVIDER_REGISTRY, get_llm
        llm = get_llm(provider="anthropic")
        assert llm.model == PROVIDER_REGISTRY["anthropic"]["default_model"]

    def test_temperature_passed(self):
        from agents.providers import get_llm
        llm = get_llm(provider="anthropic", temperature=0.7)
        assert llm.temperature == 0.7

    def test_ollama_provider(self):
        mock = _make_mock_module("ChatOllama")
        with patch.dict(sys.modules, {"langchain_ollama": mock}):
            from agents.providers import get_llm
            llm = get_llm(provider="ollama")
            assert type(llm).__name__ == "ChatOllama"

    def test_ollama_ignores_api_key(self):
        mock = _make_mock_module("ChatOllama")
        with patch.dict(sys.modules, {"langchain_ollama": mock}):
            from agents.providers import get_llm
            llm = get_llm(provider="ollama", api_key="should-be-ignored")
            assert not hasattr(llm, "api_key") or llm.api_key is None

    def test_openai_provider(self):
        mock = _make_mock_module("ChatOpenAI")
        with patch.dict(sys.modules, {"langchain_openai": mock}):
            from agents.providers import get_llm
            llm = get_llm(provider="openai", api_key="sk-test")
            assert type(llm).__name__ == "ChatOpenAI"

    def test_google_provider(self):
        mock = _make_mock_module("ChatGoogleGenerativeAI")
        with patch.dict(sys.modules, {"langchain_google_genai": mock}):
            from agents.providers import get_llm
            llm = get_llm(provider="google", api_key="goog-test")
            assert type(llm).__name__ == "ChatGoogleGenerativeAI"

    def test_unknown_provider_raises(self):
        from agents.providers import get_llm
        with pytest.raises(KeyError):
            get_llm(provider="nonexistent")

    def test_runtime_api_key_overrides_env(self):
        from agents.providers import get_llm
        llm = get_llm(provider="anthropic", api_key="runtime-key")
        assert llm.anthropic_api_key.get_secret_value() == "runtime-key"
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pytest tests/unit/test_agents/test_providers.py -v
```

Expected: `ModuleNotFoundError: No module named 'agents.providers'`

- [ ] **Step 3: Create `agents/providers.py`**

```python
"""Provider registry — single source of truth for all LLM providers.

New provider = one dict entry + `pip install langchain-<provider>`.
"""

import importlib
import os

PROVIDER_REGISTRY = {
    "anthropic": {
        "name": "Anthropic",
        "module": "langchain_anthropic",
        "class": "ChatAnthropic",
        "key_env": "ANTHROPIC_API_KEY",
        "default_model": "claude-haiku-4-5-20251001",
        "models": [
            {"id": "claude-sonnet-4-20250514", "name": "Claude Sonnet 4", "param_size": "-"},
            {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "param_size": "-"},
        ],
    },
    "openai": {
        "name": "OpenAI",
        "module": "langchain_openai",
        "class": "ChatOpenAI",
        "key_env": "OPENAI_API_KEY",
        "default_model": "gpt-4o-mini",
        "models": [
            {"id": "gpt-4o", "name": "GPT-4o", "param_size": "-"},
            {"id": "gpt-4o-mini", "name": "GPT-4o Mini", "param_size": "-"},
        ],
    },
    "google": {
        "name": "Google",
        "module": "langchain_google_genai",
        "class": "ChatGoogleGenerativeAI",
        "key_env": "GOOGLE_API_KEY",
        "default_model": "gemini-2.0-flash",
        "models": [
            {"id": "gemini-2.5-pro-preview-06-05", "name": "Gemini 2.5 Pro", "param_size": "-"},
            {"id": "gemini-2.0-flash", "name": "Gemini 2.0 Flash", "param_size": "-"},
        ],
    },
    "ollama": {
        "name": "Ollama",
        "module": "langchain_ollama",
        "class": "ChatOllama",
        "key_env": None,
        "default_model": "llama3.1",
        "models": "dynamic",
    },
}


def _build_provider_kwargs(
    provider: str,
    model: str,
    temperature: float,
    api_key: str | None,
) -> dict:
    """Build provider-specific constructor kwargs.

    Each LangChain chat model has slightly different kwarg names:
    - Anthropic/OpenAI: api_key=
    - Google: google_api_key=
    - Ollama: no api_key, uses base_url=
    """
    kwargs: dict = {"model": model, "temperature": temperature}

    if provider == "ollama":
        base_url = os.getenv("OLLAMA_URL", "http://localhost:11434")
        kwargs["base_url"] = base_url
        # Ollama does not accept api_key
    elif provider == "google":
        if api_key:
            kwargs["google_api_key"] = api_key
    else:
        # Anthropic, OpenAI, and any other provider that uses api_key=
        if api_key:
            kwargs["api_key"] = api_key

    return kwargs


def get_llm(
    provider: str = "anthropic",
    model: str | None = None,
    temperature: float = 0.0,
    api_key: str | None = None,
):
    """Return a LangChain chat model for the given provider.

    provider: key in PROVIDER_REGISTRY (e.g. "anthropic", "openai", "google", "ollama")
    model:    override the default model for the chosen provider
    api_key:  runtime key — overrides env var for this call only
    """
    entry = PROVIDER_REGISTRY[provider]
    mod = importlib.import_module(entry["module"])
    cls = getattr(mod, entry["class"])

    resolved_key = api_key or os.getenv(entry["key_env"] or "", None) or None
    resolved_model = model or entry["default_model"]

    kwargs = _build_provider_kwargs(provider, resolved_model, temperature, resolved_key)
    return cls(**kwargs)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pytest tests/unit/test_agents/test_providers.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Remove `get_llm` and defaults from `agents/config.py`**

Edit `agents/config.py` — remove the `ChatAnthropic` import, the `ANTHROPIC_DEFAULT_MODEL` / `OLLAMA_DEFAULT_MODEL` constants, and the `get_llm()` function (lines 8, 50-72). Keep `setup_logging`, `PROJECT_ROOT`, `_subprocess_env`, and `MCP_SERVERS`. The file should become:

```python
"""Configuration — MCP server paths, environment loading, logging."""

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
```

- [ ] **Step 6: Update old test file**

Replace `tests/unit/test_agents/test_config.py` contents — the `get_llm` tests moved to `test_providers.py`. Only keep a minimal config test:

```python
"""Unit tests for agents/config.py — MCP config and logging."""

from agents.config import MCP_SERVERS, PROJECT_ROOT


class TestConfig:
    def test_mcp_servers_has_three_entries(self):
        assert set(MCP_SERVERS.keys()) == {"prometheus", "grafana", "neo4j"}

    def test_project_root_exists(self):
        assert PROJECT_ROOT.exists()

    def test_mcp_servers_use_stdio(self):
        for name, cfg in MCP_SERVERS.items():
            assert cfg["transport"] == "stdio", f"{name} should use stdio transport"
```

- [ ] **Step 7: Run full agent test suite**

```bash
pytest tests/unit/test_agents/ -v
```

Expected: All tests PASS.

- [ ] **Step 8: Commit**

```bash
git add agents/providers.py agents/config.py tests/unit/test_agents/test_providers.py tests/unit/test_agents/test_config.py
git commit -m "feat: add provider registry with dynamic import, extract get_llm from config"
```

---

## Task 3: Thread `api_key` Through Agent Pipeline

**Files:**
- Modify: `agents/llm_utils.py:5,16`
- Modify: `agents/monitor.py:9,61,64`
- Modify: `agents/analyst.py:9,28,34`
- Modify: `agents/responder.py:8,16,20`
- Modify: `agents/graph.py:37-50`
- Modify: `agents/__init__.py:11,37-43,62,92-98`

- [ ] **Step 1: Fix type hint in `agents/llm_utils.py`**

Line 5 — change import:
```python
# FROM:
from langchain_anthropic import ChatAnthropic
# TO:
from langchain_core.language_models import BaseChatModel
```

Line 16 — change type hint:
```python
# FROM:
    llm: ChatAnthropic,
# TO:
    llm: BaseChatModel,
```

- [ ] **Step 2: Update `agents/monitor.py` — import + api_key param**

Line 9 — change import:
```python
# FROM:
from agents.config import get_llm
# TO:
from agents.providers import get_llm
```

Line 61 — add `api_key` parameter:
```python
# FROM:
async def monitor_node(state: PipelineState, tools: list[BaseTool], llm_provider: str = "anthropic", llm_model: str | None = None) -> dict:
# TO:
async def monitor_node(state: PipelineState, tools: list[BaseTool], llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None) -> dict:
```

Line 64 — pass `api_key`:
```python
# FROM:
    llm = get_llm(provider=llm_provider, model=llm_model)
# TO:
    llm = get_llm(provider=llm_provider, model=llm_model, api_key=api_key)
```

- [ ] **Step 3: Update `agents/analyst.py` — same pattern**

Line 9:
```python
# FROM:
from agents.config import get_llm
# TO:
from agents.providers import get_llm
```

Line 28:
```python
# FROM:
async def analyst_node(state: PipelineState, tools: list[BaseTool], llm_provider: str = "anthropic", llm_model: str | None = None) -> dict:
# TO:
async def analyst_node(state: PipelineState, tools: list[BaseTool], llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None) -> dict:
```

Line 34:
```python
# FROM:
    llm = get_llm(provider=llm_provider, model=llm_model)
# TO:
    llm = get_llm(provider=llm_provider, model=llm_model, api_key=api_key)
```

- [ ] **Step 4: Update `agents/responder.py` — same pattern**

Line 8:
```python
# FROM:
from agents.config import get_llm
# TO:
from agents.providers import get_llm
```

Line 16:
```python
# FROM:
async def responder_node(state: PipelineState, tools: list[BaseTool], llm_provider: str = "anthropic", llm_model: str | None = None) -> dict:
# TO:
async def responder_node(state: PipelineState, tools: list[BaseTool], llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None) -> dict:
```

Line 20:
```python
# FROM:
    llm = get_llm(provider=llm_provider, model=llm_model)
# TO:
    llm = get_llm(provider=llm_provider, model=llm_model, api_key=api_key)
```

- [ ] **Step 5: Update `agents/graph.py` — thread `api_key` through `partial()`**

Line 37-43 — add `api_key` param to `build_graph`:
```python
# FROM:
def build_graph(
    monitor_tools: list[BaseTool],
    analyst_tools: list[BaseTool],
    responder_tools: list[BaseTool],
    llm_provider: str = "anthropic",
    llm_model: str | None = None,
):
# TO:
def build_graph(
    monitor_tools: list[BaseTool],
    analyst_tools: list[BaseTool],
    responder_tools: list[BaseTool],
    llm_provider: str = "anthropic",
    llm_model: str | None = None,
    api_key: str | None = None,
):
```

Lines 48-50 — add `api_key` to each `partial()`:
```python
# FROM:
    graph.add_node("monitor", partial(monitor_node, tools=monitor_tools, llm_provider=llm_provider, llm_model=llm_model))
    graph.add_node("analyst", partial(analyst_node, tools=analyst_tools, llm_provider=llm_provider, llm_model=llm_model))
    graph.add_node("responder", partial(responder_node, tools=responder_tools, llm_provider=llm_provider, llm_model=llm_model))
# TO:
    graph.add_node("monitor", partial(monitor_node, tools=monitor_tools, llm_provider=llm_provider, llm_model=llm_model, api_key=api_key))
    graph.add_node("analyst", partial(analyst_node, tools=analyst_tools, llm_provider=llm_provider, llm_model=llm_model, api_key=api_key))
    graph.add_node("responder", partial(responder_node, tools=responder_tools, llm_provider=llm_provider, llm_model=llm_model, api_key=api_key))
```

- [ ] **Step 6: Update `agents/__init__.py` — accept + pass `api_key`**

`run_pipeline` signature (line 11):
```python
# FROM:
async def run_pipeline(verbose: bool = True, llm_provider: str = "anthropic", llm_model: str | None = None) -> dict:
# TO:
async def run_pipeline(verbose: bool = True, llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None) -> dict:
```

`build_graph` call inside `run_pipeline` (around line 37):
```python
# FROM:
        compiled = build_graph(
            monitor_tools=filter_tools(all_tools, MONITOR_TOOLS),
            analyst_tools=filter_tools(all_tools, ANALYST_TOOLS),
            responder_tools=filter_tools(all_tools, RESPONDER_TOOLS),
            llm_provider=llm_provider,
            llm_model=llm_model,
        )
# TO:
        compiled = build_graph(
            monitor_tools=filter_tools(all_tools, MONITOR_TOOLS),
            analyst_tools=filter_tools(all_tools, ANALYST_TOOLS),
            responder_tools=filter_tools(all_tools, RESPONDER_TOOLS),
            llm_provider=llm_provider,
            llm_model=llm_model,
            api_key=api_key,
        )
```

`stream_pipeline` signature (line 62):
```python
# FROM:
async def stream_pipeline(verbose: bool = False, llm_provider: str = "anthropic", llm_model: str | None = None):
# TO:
async def stream_pipeline(verbose: bool = False, llm_provider: str = "anthropic", llm_model: str | None = None, api_key: str | None = None):
```

`build_graph` call inside `stream_pipeline` (around line 92):
```python
# FROM:
                compiled = build_graph(
                    monitor_tools=filter_tools(all_tools, MONITOR_TOOLS),
                    analyst_tools=filter_tools(all_tools, ANALYST_TOOLS),
                    responder_tools=filter_tools(all_tools, RESPONDER_TOOLS),
                    llm_provider=llm_provider,
                    llm_model=llm_model,
                )
# TO:
                compiled = build_graph(
                    monitor_tools=filter_tools(all_tools, MONITOR_TOOLS),
                    analyst_tools=filter_tools(all_tools, ANALYST_TOOLS),
                    responder_tools=filter_tools(all_tools, RESPONDER_TOOLS),
                    llm_provider=llm_provider,
                    llm_model=llm_model,
                    api_key=api_key,
                )
```

- [ ] **Step 7: Run unit tests**

```bash
pytest tests/unit/test_agents/ -v
```

Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add agents/llm_utils.py agents/monitor.py agents/analyst.py agents/responder.py agents/graph.py agents/__init__.py
git commit -m "feat: thread api_key through entire agent pipeline, fix BaseChatModel type hint"
```

---

## Task 4: Backend API — Provider Routes + CORS + Pipeline Updates

**Files:**
- Create: `api_backend/routes/providers.py`
- Modify: `api_backend/app.py`
- Modify: `api_backend/routes/pipeline.py`
- Modify: `api_backend/routes/rag.py`
- Delete: `api_backend/routes/models.py`
- Modify: `pyproject.toml` (add new deps)

- [ ] **Step 1: Add new Python dependencies to `pyproject.toml`**

Add `langchain-openai` and `langchain-google-genai` to the dependencies list:

```toml
# Add these two lines to the dependencies array:
    "langchain-openai>=0.3",
    "langchain-google-genai>=2.0",
```

Then install:
```bash
pip3 install langchain-openai langchain-google-genai --break-system-packages
```

- [ ] **Step 2: Create `api_backend/routes/providers.py`**

```python
"""Provider listing and health check endpoints."""

import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Header, HTTPException

from agents.providers import PROVIDER_REGISTRY, get_llm

router = APIRouter()

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434")


def _provider_available(entry: dict) -> bool:
    """Check if a provider has its env key configured (or is keyless like Ollama)."""
    key_env = entry.get("key_env")
    if key_env is None:
        return True  # Ollama — no key needed
    return bool(os.getenv(key_env))


async def _get_ollama_models() -> list[dict]:
    """Fetch live model list from Ollama API."""
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
            r.raise_for_status()
            data = r.json()
            return [
                {
                    "id": m["name"],
                    "name": m["name"],
                    "param_size": m.get("details", {}).get("parameter_size", ""),
                }
                for m in data.get("models", [])
            ]
    except Exception:
        return []


@router.get("/list")
async def list_providers():
    """Return all registered providers with availability and models."""
    providers = []
    for pid, entry in PROVIDER_REGISTRY.items():
        models = entry["models"]
        if models == "dynamic":
            models = await _get_ollama_models()

        providers.append({
            "id": pid,
            "name": entry["name"],
            "available": _provider_available(entry),
            "requires_key": entry["key_env"] is not None,
            "models": models,
            "default_model": entry["default_model"],
        })

    return {"providers": providers}


@router.get("/{provider_id}/health")
async def check_provider_health(
    provider_id: str,
    x_provider_key: str | None = Header(None, alias="X-Provider-Key"),
):
    """Lightweight provider connectivity check.

    Accepts optional runtime API key via X-Provider-Key header (not query param —
    keys in URLs leak into logs).
    """
    if provider_id not in PROVIDER_REGISTRY:
        raise HTTPException(status_code=422, detail={
            "error": f"Provider '{provider_id}' not found",
            "code": "UNKNOWN_PROVIDER",
        })

    entry = PROVIDER_REGISTRY[provider_id]
    runtime_key = x_provider_key
    start = datetime.now(timezone.utc)

    try:
        if provider_id == "ollama":
            async with httpx.AsyncClient() as client:
                r = await client.get(f"{OLLAMA_URL}/api/tags", timeout=5.0)
                r.raise_for_status()
        else:
            env_key = os.getenv(entry["key_env"] or "", None)
            key = runtime_key or env_key
            if not key:
                return {
                    "provider": provider_id,
                    "status": "no_key",
                    "latency_ms": 0,
                    "checked_at": start.isoformat(),
                }
            # Tiny completion to verify connectivity
            llm = get_llm(provider=provider_id, api_key=key, temperature=0.0)
            await llm.ainvoke("ping", max_tokens=1)

        elapsed = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        return {
            "provider": provider_id,
            "status": "healthy",
            "latency_ms": round(elapsed),
            "checked_at": start.isoformat(),
        }
    except Exception as exc:
        elapsed = (datetime.now(timezone.utc) - start).total_seconds() * 1000
        return {
            "provider": provider_id,
            "status": "unhealthy",
            "latency_ms": round(elapsed),
            "checked_at": start.isoformat(),
            "error": str(exc),
        }
```

- [ ] **Step 3: Update `api_backend/routes/pipeline.py` — add `api_key` field**

Change `PipelineRequest` (lines 16-18):
```python
# FROM:
class PipelineRequest(BaseModel):
    llm_provider: str = "anthropic"
    llm_model: str | None = None

# TO:
from pydantic import Field

class PipelineRequest(BaseModel):
    llm_provider: str = "anthropic"
    llm_model: str | None = None
    api_key: str | None = Field(None, repr=False)
```

Update `stream_pipeline` call inside `_run()` (around line 99):
```python
# FROM:
            async for event in stream_pipeline(
                verbose=False,
                llm_provider=req.llm_provider,
                llm_model=req.llm_model,
            ):
# TO:
            async for event in stream_pipeline(
                verbose=False,
                llm_provider=req.llm_provider,
                llm_model=req.llm_model,
                api_key=req.api_key,
            ):
```

- [ ] **Step 4: Update `api_backend/routes/rag.py` — add judge params**

Replace entire file:
```python
"""GraphRAG vs Naive RAG evaluation endpoint."""

from fastapi import APIRouter
from pydantic import BaseModel, Field

from graph.retrieval import graphrag_retrieve, naive_rag_retrieve

router = APIRouter()


class EvalRequest(BaseModel):
    query: str
    service_context: str | None = None
    top_k: int = 5
    judge_provider: str = "anthropic"
    judge_model: str | None = None
    judge_api_key: str | None = Field(None, repr=False)


@router.post("/evaluate")
async def evaluate_rag(req: EvalRequest):
    graphrag_results = await graphrag_retrieve(
        query=req.query,
        service_context=req.service_context,
        top_k=req.top_k,
    )
    naive_results = await naive_rag_retrieve(
        query=req.query,
        top_k=req.top_k,
    )
    return {
        "query": req.query,
        "graphrag": graphrag_results,
        "naive": naive_results,
        "judge_provider": req.judge_provider,
        "judge_model": req.judge_model,
    }
```

- [ ] **Step 5: Update `api_backend/app.py` — CORS + router swap**

Replace entire file:
```python
"""InfraWatch API Backend — control plane for the monitoring system."""

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from api_backend.routes import health, pipeline, graph, anomaly, rag, providers


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="InfraWatch API", version="0.2.0", lifespan=lifespan)

ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3001").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router, tags=["health"])
app.include_router(pipeline.router, prefix="/pipeline", tags=["pipeline"])
app.include_router(graph.router, prefix="/graph", tags=["graph"])
app.include_router(anomaly.router, prefix="/anomaly", tags=["anomaly"])
app.include_router(rag.router, prefix="/rag", tags=["rag"])
app.include_router(providers.router, prefix="/providers", tags=["providers"])
```

- [ ] **Step 6: Delete `api_backend/routes/models.py`**

```bash
rm api_backend/routes/models.py
```

- [ ] **Step 7: Run backend tests**

```bash
pytest tests/unit/ -v
```

Expected: All pass. (Any test importing `models` route will need fixing — check for import errors.)

- [ ] **Step 8: Commit**

```bash
git add api_backend/ agents/providers.py pyproject.toml
git rm api_backend/routes/models.py
git commit -m "feat: add /providers/list and /providers/{id}/health endpoints, env-configurable CORS"
```

---

## Task 5: Refactor `evaluate_rag.py` — Remove Raw Anthropic SDK

**Files:**
- Modify: `scripts/evaluate_rag.py`

- [ ] **Step 1: Replace `_llm_judge` to use `get_llm()` from registry**

Replace the imports section (lines 1-23):
```python
# FROM:
import anthropic
# (remove this import entirely)

# Add at top:
from agents.providers import get_llm
```

Replace `_llm_judge` function (lines 232-280):
```python
async def _llm_judge(
    query: str,
    content: str,
    provider: str = "anthropic",
    model: str | None = None,
    api_key: str | None = None,
) -> dict:
    """Score retrieved content using any registered LLM provider.

    Returns dict with keys: content_relevance (1-10), actionability (1-10).
    Falls back to neutral scores on any error.
    """
    print(f"[llm_judge] provider={provider} model={model} query={query[:50]!r}")
    prompt = _build_judge_prompt(query, content)

    try:
        llm = get_llm(provider=provider, model=model, api_key=api_key, temperature=0.0)
        response = await llm.ainvoke(prompt)
        text = response.content if isinstance(response.content, str) else str(response.content)
        print(f"[llm_judge] raw response: {text!r}")
        return _parse_judge_response(text)
    except Exception as e:
        print(f"[llm_judge] ERROR: {type(e).__name__}: {e}")
    return {"content_relevance": 5, "actionability": 5}
```

Update `evaluate_single` signature (line 286):
```python
# FROM:
async def evaluate_single(query_info: dict, judge_provider: str = "anthropic", ollama_model: str = "llama3.1") -> dict:
# TO:
async def evaluate_single(query_info: dict, judge_provider: str = "anthropic", judge_model: str | None = None) -> dict:
```

Update `_llm_judge` calls inside `evaluate_single` (lines 306-308):
```python
# FROM:
    gr_judge, nr_judge = await asyncio.gather(
        _llm_judge(query_info["query"], gr_fmt, provider=judge_provider, ollama_model=ollama_model),
        _llm_judge(query_info["query"], nr_fmt, provider=judge_provider, ollama_model=ollama_model),
    )
# TO:
    gr_judge, nr_judge = await asyncio.gather(
        _llm_judge(query_info["query"], gr_fmt, provider=judge_provider, model=judge_model),
        _llm_judge(query_info["query"], nr_fmt, provider=judge_provider, model=judge_model),
    )
```

Update `evaluate_all` signature (line 319):
```python
# FROM:
async def evaluate_all(
    queries: list[dict] | None = None,
    judge_provider: str = "anthropic",
    ollama_model: str = "llama3.1",
) -> list[dict]:
# TO:
async def evaluate_all(
    queries: list[dict] | None = None,
    judge_provider: str = "anthropic",
    judge_model: str | None = None,
) -> list[dict]:
```

Update `evaluate_single` call inside `evaluate_all` (line 329):
```python
# FROM:
        result = await evaluate_single(q, judge_provider=judge_provider, ollama_model=ollama_model)
# TO:
        result = await evaluate_single(q, judge_provider=judge_provider, judge_model=judge_model)
```

Update CLI args in `main()` (lines 378-382):
```python
# FROM:
    parser.add_argument(
        "--ollama-model",
        default="llama3.1",
        help="Ollama model name when --provider=ollama (default: llama3.1)",
    )
# TO:
    parser.add_argument(
        "--model",
        default=None,
        help="Model name override for the judge provider",
    )
```

Also remove `choices=["anthropic", "ollama"]` constraint from `--provider` arg (line 375):
```python
# FROM:
    parser.add_argument(
        "--provider",
        choices=["anthropic", "ollama"],
        default="anthropic",
        help="LLM judge provider (default: anthropic)",
    )
# TO:
    parser.add_argument(
        "--provider",
        default="anthropic",
        help="LLM judge provider — any registered provider ID (default: anthropic)",
    )
```

Update `asyncio.run` call (line 396):
```python
# FROM:
    results = asyncio.run(evaluate_all(queries, judge_provider=args.provider, ollama_model=args.ollama_model))
# TO:
    results = asyncio.run(evaluate_all(queries, judge_provider=args.provider, judge_model=args.model))
```

Update print line (lines 394-395):
```python
# FROM:
    print(f"Running evaluation... (judge: {args.provider}" +
          (f", model: {args.ollama_model}" if args.provider == "ollama" else "") + ")")
# TO:
    print(f"Running evaluation... (judge: {args.provider}" +
          (f", model: {args.model}" if args.model else "") + ")")
```

- [ ] **Step 2: Verify script still parses correctly**

```bash
python scripts/evaluate_rag.py --help
```

Expected: Shows `--provider` and `--model` args, no `--ollama-model`.

- [ ] **Step 3: Commit**

```bash
git add scripts/evaluate_rag.py
git commit -m "refactor: replace raw Anthropic SDK in evaluate_rag with provider registry get_llm"
```

---

## Task 6: Frontend — Install Dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install new packages**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm add @lobehub/icons-react lucide-animated
```

- [ ] **Step 2: Verify install succeeded**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm ls @lobehub/icons-react lucide-animated
```

Expected: Both packages listed with versions.

- [ ] **Step 3: Commit**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && git add frontend/package.json frontend/pnpm-lock.yaml
git commit -m "chore: add @lobehub/icons-react and lucide-animated"
```

---

## Task 7: Frontend — Provider Display Map + Key Storage

**Files:**
- Create: `frontend/src/lib/provider-display.ts`
- Create: `frontend/src/lib/provider-keys.ts`

- [ ] **Step 1: Create `frontend/src/lib/provider-display.ts`**

```ts
import type { FC, SVGProps } from "react";
import { Anthropic, OpenAI, Google, Ollama } from "@lobehub/icons-react";
import { BrainCircuit } from "lucide-react";

export type ProviderDisplay = {
  icon: FC<SVGProps<SVGSVGElement>>;
  color: string;
  description: string;
};

const PROVIDER_DISPLAY: Record<string, ProviderDisplay> = {
  anthropic: { icon: Anthropic, color: "#D97757", description: "Claude models" },
  openai: { icon: OpenAI, color: "#10A37F", description: "GPT models" },
  google: { icon: Google, color: "#4285F4", description: "Gemini models" },
  ollama: { icon: Ollama, color: "#FFFFFF", description: "Local models" },
};

const DEFAULT_DISPLAY: ProviderDisplay = {
  icon: BrainCircuit,
  color: "#888888",
  description: "Custom provider",
};

export function getProviderDisplay(id: string): ProviderDisplay {
  return PROVIDER_DISPLAY[id] ?? DEFAULT_DISPLAY;
}
```

Note: The exact icon component names from `@lobehub/icons-react` may differ. After install, check the actual exports:
```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && node -e "const m = require('@lobehub/icons-react'); console.log(Object.keys(m).filter(k => /anthropic|openai|google|ollama/i.test(k)).join('\n'))"
```

Adjust import names to match actual exports.

- [ ] **Step 2: Create `frontend/src/lib/provider-keys.ts`**

```ts
const PREFIX = "provider-key:";

export function getStoredKey(providerId: string): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(`${PREFIX}${providerId}`);
}

export function storeKey(providerId: string, key: string): void {
  sessionStorage.setItem(`${PREFIX}${providerId}`, key);
}

export function clearKey(providerId: string): void {
  sessionStorage.removeItem(`${PREFIX}${providerId}`);
}
```

- [ ] **Step 3: Commit**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && git add frontend/src/lib/provider-display.ts frontend/src/lib/provider-keys.ts
git commit -m "feat: add provider display map (lobeicons) and sessionStorage key helpers"
```

---

## Task 8: Frontend — Provider Service Layer + API Proxy

**Files:**
- Create: `frontend/src/services/providers/schema.ts`
- Create: `frontend/src/services/providers/query-options.ts`
- Create: `frontend/src/app/api/providers/[...path]/route.ts`
- Delete: `frontend/src/services/models/schema.ts`
- Delete: `frontend/src/services/models/query-options.ts`
- Delete: `frontend/src/app/api/models/[...path]/route.ts`

- [ ] **Step 1: Create `frontend/src/services/providers/schema.ts`**

```ts
import { z } from "zod";

export const providerModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  param_size: z.string(),
});

export type ProviderModel = z.infer<typeof providerModelSchema>;

export const providerSchema = z.object({
  id: z.string(),
  name: z.string(),
  available: z.boolean(),
  requires_key: z.boolean(),
  models: z.array(providerModelSchema),
  default_model: z.string(),
});

export type Provider = z.infer<typeof providerSchema>;

export const providersResponseSchema = z.object({
  providers: z.array(providerSchema),
});

export type ProvidersResponse = z.infer<typeof providersResponseSchema>;

export const healthResponseSchema = z.object({
  provider: z.string(),
  status: z.enum(["healthy", "unhealthy", "no_key"]),
  latency_ms: z.number(),
  checked_at: z.string(),
  error: z.string().optional(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
```

- [ ] **Step 2: Create `frontend/src/services/providers/query-options.ts`**

```ts
import { queryOptions } from "@tanstack/react-query";
import { apiClient } from "@/services/_shared/fetch-client";
import type { ProvidersResponse, HealthResponse } from "./schema";

export const providerKeys = {
  all: ["providers"] as const,
  list: () => [...providerKeys.all, "list"] as const,
  health: (id: string) => [...providerKeys.all, "health", id] as const,
};

export const providerQueries = {
  list: () =>
    queryOptions({
      queryKey: providerKeys.list(),
      queryFn: () => apiClient<ProvidersResponse>("/api/providers/list"),
      staleTime: 30_000,
    }),
  health: (providerId: string) =>
    queryOptions({
      queryKey: providerKeys.health(providerId),
      queryFn: () =>
        apiClient<HealthResponse>(`/api/providers/${providerId}/health`),
      enabled: false, // only triggered manually
    }),
};
```

- [ ] **Step 3: Create `frontend/src/app/api/providers/[...path]/route.ts`**

```ts
import { createProxy } from "../../_proxy";
import { apiBackendUrl } from "@/services/_shared/fetch-server";
const proxy = createProxy(apiBackendUrl, "providers");
export const { GET, POST, PUT, DELETE } = proxy;
```

Note: The `_proxy.ts` only forwards `Content-Type`. The `X-Provider-Key` header must also be forwarded for health checks. Add this to the `headers` construction in `_proxy.ts`:

```ts
// In createProxy handler, after the Content-Type header line, add:
const providerKey = req.headers.get("X-Provider-Key");
if (providerKey) headers.set("X-Provider-Key", providerKey);
```

- [ ] **Step 4: Delete old models service files**

```bash
rm frontend/src/services/models/schema.ts frontend/src/services/models/query-options.ts
rmdir frontend/src/services/models
rm -rf frontend/src/app/api/models
```

- [ ] **Step 5: Commit**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && git add frontend/src/services/providers/ frontend/src/app/api/providers/
git rm -r frontend/src/services/models/ frontend/src/app/api/models/
git commit -m "feat: add providers service layer + API proxy, remove old models service"
```

---

## Task 9: Frontend — Toast System

**Files:**
- Create: `frontend/src/components/ui/toast-provider.tsx`
- Create: `frontend/src/components/ui/toast.tsx`
- Create: `frontend/src/hooks/use-toast.ts`
- Modify: `frontend/src/app/layout.tsx`

- [ ] **Step 1: Create `frontend/src/hooks/use-toast.ts`**

```ts
"use client";

import { useCallback, useSyncExternalStore } from "react";

export type ToastVariant = "success" | "error" | "info";

export type Toast = {
  id: string;
  variant: ToastVariant;
  message: string;
  duration: number;
};

type Listener = () => void;

let toasts: Toast[] = [];
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l());
}

function addToast(variant: ToastVariant, message: string, duration = 4000) {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  toasts = [...toasts, { id, variant, message, duration }];
  emit();
  setTimeout(() => {
    dismissToast(id);
  }, duration);
}

function dismissToast(id: string) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (message: string, duration?: number) => addToast("success", message, duration),
  error: (message: string, duration?: number) => addToast("error", message, duration),
  info: (message: string, duration?: number) => addToast("info", message, duration),
  dismiss: dismissToast,
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => toasts,
    () => [],
  );
}
```

- [ ] **Step 2: Create `frontend/src/components/ui/toast.tsx`**

```tsx
"use client";

import { motion, AnimatePresence } from "motion/react";
import { X, CheckCircle2, AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Toast, ToastVariant } from "@/hooks/use-toast";
import { toast as toastApi } from "@/hooks/use-toast";

const VARIANT_STYLES: Record<ToastVariant, { icon: typeof CheckCircle2; className: string }> = {
  success: { icon: CheckCircle2, className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" },
  error: { icon: AlertCircle, className: "border-red-500/30 bg-red-500/10 text-red-400" },
  info: { icon: Info, className: "border-blue-500/30 bg-blue-500/10 text-blue-400" },
};

function ToastItem({ toast: t }: { toast: Toast }) {
  const { icon: Icon, className } = VARIANT_STYLES[t.variant];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8, scale: 0.95 }}
      className={cn(
        "pointer-events-auto flex items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">{t.message}</span>
      <button
        onClick={() => toastApi.dismiss(t.id)}
        className="ml-auto shrink-0 rounded-md p-1 opacity-50 hover:opacity-100 transition-opacity"
      >
        <X className="h-3 w-3" />
      </button>
    </motion.div>
  );
}

export function ToastViewport({ toasts }: { toasts: Toast[] }) {
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} />
        ))}
      </AnimatePresence>
    </div>
  );
}
```

- [ ] **Step 3: Create `frontend/src/components/ui/toast-provider.tsx`**

```tsx
"use client";

import { useToasts } from "@/hooks/use-toast";
import { ToastViewport } from "./toast";

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const toasts = useToasts();

  return (
    <>
      {children}
      <ToastViewport toasts={toasts} />
    </>
  );
}
```

- [ ] **Step 4: Add `<ToastProvider>` to layout**

Edit `frontend/src/app/layout.tsx` — add import and wrap:

Add import at top:
```ts
import { ToastProvider } from "@/components/ui/toast-provider";
```

Wrap inside `<Providers>`:
```tsx
// FROM:
        <Providers>
          <SidebarProvider>
            <AppSidebar />
            <main className="flex-1 overflow-auto px-8 py-7">{children}</main>
          </SidebarProvider>
        </Providers>

// TO:
        <Providers>
          <ToastProvider>
            <SidebarProvider>
              <AppSidebar />
              <main className="flex-1 overflow-auto px-8 py-7">{children}</main>
            </SidebarProvider>
          </ToastProvider>
        </Providers>
```

- [ ] **Step 5: Commit**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && git add frontend/src/hooks/use-toast.ts frontend/src/components/ui/toast.tsx frontend/src/components/ui/toast-provider.tsx frontend/src/app/layout.tsx
git commit -m "feat: add toast notification system with success/error/info variants"
```

---

## Task 10: Frontend — `<ProviderSelector>` Component

**Files:**
- Create: `frontend/src/components/provider-selector.tsx`

- [ ] **Step 1: Create `frontend/src/components/provider-selector.tsx`**

```tsx
"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { providerQueries } from "@/services/providers/query-options";
import { getProviderDisplay } from "@/lib/provider-display";
import { getStoredKey, storeKey, clearKey } from "@/lib/provider-keys";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Lock, KeyRound, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Provider } from "@/services/providers/schema";

export type ProviderSelection = {
  provider: string;
  model: string;
  apiKey?: string | null;
};

interface ProviderSelectorProps {
  value: ProviderSelection;
  onChange: (value: ProviderSelection) => void;
  label?: string;
}

export function ProviderSelector({ value, onChange, label = "LLM Provider" }: ProviderSelectorProps) {
  const { data, isLoading } = useQuery(providerQueries.list());
  const queryClient = useQueryClient();
  const providers = data?.providers ?? [];

  const [keyInput, setKeyInput] = useState("");
  const [healthStatus, setHealthStatus] = useState<"idle" | "checking" | "healthy" | "unhealthy">("idle");

  const current = providers.find((p) => p.id === value.provider);
  const display = getProviderDisplay(value.provider);
  const storedKey = getStoredKey(value.provider);
  const needsKey = current?.requires_key && !current?.available && !storedKey;

  // Restore key from session storage on provider switch
  useEffect(() => {
    const key = getStoredKey(value.provider);
    if (key) {
      onChange({ ...value, apiKey: key });
    }
  }, [value.provider]);

  async function checkHealth(providerId: string) {
    setHealthStatus("checking");
    try {
      const key = getStoredKey(providerId);
      const headers: Record<string, string> = {};
      if (key) headers["X-Provider-Key"] = key;
      const res = await fetch(`/api/providers/${providerId}/health`, { headers });
      const data = await res.json();
      if (data.status === "healthy") {
        setHealthStatus("healthy");
        toast.success(`Connected to ${getProviderDisplay(providerId).description} (${data.latency_ms}ms)`);
      } else {
        setHealthStatus("unhealthy");
        toast.error(data.error || `${providerId} unavailable`);
      }
    } catch {
      setHealthStatus("unhealthy");
      toast.error(`Failed to reach ${providerId}`);
    }
    // Reset after 5s
    setTimeout(() => setHealthStatus("idle"), 5000);
  }

  function handleProviderChange(providerId: string) {
    const prov = providers.find((p) => p.id === providerId);
    const key = getStoredKey(providerId);
    onChange({
      provider: providerId,
      model: prov?.default_model ?? "",
      apiKey: key,
    });
    setHealthStatus("idle");
    setKeyInput("");
  }

  function handleSaveKey() {
    if (!keyInput.trim()) return;
    storeKey(value.provider, keyInput.trim());
    onChange({ ...value, apiKey: keyInput.trim() });
    setKeyInput("");
    toast.info("API key saved for this session");
    checkHealth(value.provider);
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading providers...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Label */}
      <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wider">
        {label}
      </label>

      {/* Provider pills */}
      <div className="bg-secondary/50 flex flex-wrap gap-1 rounded-lg p-1">
        {providers.map((p) => {
          const d = getProviderDisplay(p.id);
          const Icon = d.icon;
          const isActive = value.provider === p.id;

          return (
            <button
              key={p.id}
              onClick={() => handleProviderChange(p.id)}
              className={cn(
                "relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                !isActive && "text-muted-foreground hover:text-foreground",
              )}
            >
              {isActive && (
                <motion.div
                  layoutId="provider-pill"
                  className="bg-primary/15 border-primary/20 absolute inset-0 rounded-md border"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <Icon className="relative z-10 h-4 w-4" style={isActive ? { color: d.color } : undefined} />
              <span className="relative z-10">{p.name}</span>
              {p.available && p.requires_key && (
                <Lock className="relative z-10 h-3 w-3 text-muted-foreground/50" />
              )}
              {/* Health dot */}
              {isActive && healthStatus === "healthy" && (
                <span className="relative z-10 h-2 w-2 rounded-full bg-emerald-500" />
              )}
              {isActive && healthStatus === "unhealthy" && (
                <span className="relative z-10 h-2 w-2 rounded-full bg-red-500" />
              )}
              {isActive && healthStatus === "checking" && (
                <Loader2 className="relative z-10 h-3 w-3 animate-spin text-muted-foreground" />
              )}
            </button>
          );
        })}
      </div>

      {/* Model dropdown */}
      {current && current.models.length > 0 && (
        <div className="space-y-2">
          <label className="text-muted-foreground block text-xs font-medium uppercase tracking-wider">
            Model
          </label>
          <Select
            value={value.model}
            onValueChange={(m) => onChange({ ...value, model: m })}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Available Models</SelectLabel>
                {current.models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-mono text-sm">{m.name}</span>
                      {m.param_size !== "-" && (
                        <span className="text-xs text-muted-foreground">{m.param_size}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* API key input — shown when provider needs a key and none is stored */}
      {needsKey && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="space-y-2"
        >
          <label className="text-muted-foreground block text-xs font-medium uppercase tracking-wider">
            API Key
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <KeyRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                type="password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                placeholder="Paste API key..."
                className="pl-10"
              />
            </div>
            <Button onClick={handleSaveKey} disabled={!keyInput.trim()} size="sm">
              Save
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Stored in session only — cleared when you close this tab.
          </p>
        </motion.div>
      )}

      {/* Stored key indicator */}
      {storedKey && current?.requires_key && !current?.available && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Check className="h-3 w-3 text-emerald-500" />
          <span>Session key active</span>
          <button
            onClick={() => {
              clearKey(value.provider);
              onChange({ ...value, apiKey: null });
              toast.info("API key cleared");
            }}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm typecheck
```

Expected: No errors related to provider-selector.

- [ ] **Step 3: Commit**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && git add frontend/src/components/provider-selector.tsx
git commit -m "feat: add shared ProviderSelector component with icons, model picker, key input, health check"
```

---

## Task 11: Frontend — Integrate ProviderSelector into Pipeline Page

**Files:**
- Modify: `frontend/src/app/pipeline/_components/pipeline-controls.tsx`
- Modify: `frontend/src/services/pipeline/use-pipeline.ts`

- [ ] **Step 1: Rewrite `pipeline-controls.tsx`**

Replace entire file:

```tsx
"use client";

import { useState } from "react";
import { usePipelineStream } from "@/services/pipeline/use-pipeline";
import { ProviderSelector, type ProviderSelection } from "@/components/provider-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Loader2 } from "lucide-react";
import { motion } from "motion/react";

export function PipelineControls() {
  const [selection, setSelection] = useState<ProviderSelection>({
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  });
  const mutation = usePipelineStream();

  const canRun = !mutation.isPending && !!selection.model;

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Pipeline Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ProviderSelector value={selection} onChange={setSelection} />

        <Button
          onClick={() =>
            mutation.mutate({
              llmProvider: selection.provider,
              llmModel: selection.model,
              apiKey: selection.apiKey ?? undefined,
            })
          }
          disabled={!canRun}
          className="w-full gap-2 py-5 text-sm font-medium"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Pipeline
            </>
          )}
        </Button>

        {mutation.isError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-destructive text-sm"
          >
            {mutation.error.message}
          </motion.p>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Update `use-pipeline.ts` — send `api_key`**

In `frontend/src/services/pipeline/use-pipeline.ts`, update the mutation function params and request body.

Change the `mutationFn` parameter type and body (around lines 77-90):

```ts
// FROM:
    mutationFn: async (params: {
      llmProvider?: string;
      llmModel?: string;
    }) => {
      // ...
      const res = await apiClientStream("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: params.llmProvider ?? "anthropic",
          llm_model: params.llmModel ?? null,
        }),
      });

// TO:
    mutationFn: async (params: {
      llmProvider?: string;
      llmModel?: string;
      apiKey?: string;
    }) => {
      // ...
      const res = await apiClientStream("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: params.llmProvider ?? "anthropic",
          llm_model: params.llmModel ?? null,
          api_key: params.apiKey ?? null,
        }),
      });
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && git add frontend/src/app/pipeline/_components/pipeline-controls.tsx frontend/src/services/pipeline/use-pipeline.ts
git commit -m "feat: integrate ProviderSelector into pipeline page, send api_key per request"
```

---

## Task 12: Frontend — Integrate ProviderSelector into Evaluation Page

**Files:**
- Modify: `frontend/src/app/evaluation/_components/eval-form.tsx`
- Modify: `frontend/src/services/rag/actions.ts`

- [ ] **Step 1: Update `eval-form.tsx` — add judge provider selector**

Add imports and state at top of component:

```tsx
// Add import:
import { ProviderSelector, type ProviderSelection } from "@/components/provider-selector";

// Inside EvalForm component, add state:
const [judgeSelection, setJudgeSelection] = useState<ProviderSelection>({
  provider: "anthropic",
  model: "claude-haiku-4-5-20251001",
});
```

Update mutation to pass judge params:
```tsx
// FROM:
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await evaluateRag(query, serviceContext || undefined);
      return unwrap(result);
    },

// TO:
  const mutation = useMutation({
    mutationFn: async () => {
      const result = await evaluateRag(
        query,
        serviceContext || undefined,
        judgeSelection.provider,
        judgeSelection.model,
        judgeSelection.apiKey ?? undefined,
      );
      return unwrap(result);
    },
```

Add `<ProviderSelector>` to JSX after the service context input section but before the Compare button:
```tsx
<ProviderSelector
  value={judgeSelection}
  onChange={setJudgeSelection}
  label="Judge LLM"
/>
```

- [ ] **Step 2: Update `frontend/src/services/rag/actions.ts` — pass judge params**

```ts
// FROM:
export async function evaluateRag(query: string, serviceContext?: string) {
  return safeAction(
    () =>
      serverFetch<RagResult>(apiBackendUrl, "/rag/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          service_context: serviceContext ?? null,
          top_k: 5,
        }),
      }),
    { code: "RAG_EVAL_FAILED", message: "Failed to evaluate RAG" },
  );
}

// TO:
export async function evaluateRag(
  query: string,
  serviceContext?: string,
  judgeProvider?: string,
  judgeModel?: string,
  judgeApiKey?: string,
) {
  return safeAction(
    () =>
      serverFetch<RagResult>(apiBackendUrl, "/rag/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          service_context: serviceContext ?? null,
          top_k: 5,
          judge_provider: judgeProvider ?? "anthropic",
          judge_model: judgeModel ?? null,
          judge_api_key: judgeApiKey ?? null,
        }),
      }),
    { code: "RAG_EVAL_FAILED", message: "Failed to evaluate RAG" },
  );
}
```

- [ ] **Step 3: Verify build**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm typecheck
```

- [ ] **Step 4: Commit**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && git add frontend/src/app/evaluation/_components/eval-form.tsx frontend/src/services/rag/actions.ts
git commit -m "feat: add judge provider selector to RAG evaluation page"
```

---

## Task 13: Final Verification

**Files:** None new — verification only.

- [ ] **Step 1: Run all Python tests**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && pytest tests/unit/ -v
```

Expected: All pass.

- [ ] **Step 2: Run frontend type check**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm typecheck
```

Expected: No errors.

- [ ] **Step 3: Run frontend lint**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm lint
```

Expected: Clean or only pre-existing warnings.

- [ ] **Step 4: Build frontend**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm build
```

Expected: Successful build.

- [ ] **Step 5: Smoke test — start backend and verify `/providers/list`**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && uvicorn api_backend.app:app --port 8090 &
sleep 2
curl -s http://localhost:8090/providers/list | python3 -m json.tool
kill %1
```

Expected: JSON response with 4 providers (anthropic, openai, google, ollama), each with models array.

- [ ] **Step 6: Verify git is clean**

```bash
git status
```

Expected: Clean working tree, all changes committed.
