# Runtime Provider Integration — Design Spec

**Date**: 2026-04-16
**Status**: Approved
**Scope**: Backend provider registry, frontend provider selector with icons, health checks, toast system, cleanup

---

## Problem

InfraWatch AI hardcodes a binary Anthropic/Ollama provider choice. Model selection only works for Ollama. No brand icons, no runtime API key input, no health checks. RAG evaluation uses raw Anthropic SDK bypassing the LLM factory. Stale Streamlit UI still in docker-compose.

## Goals

1. Any LangChain-compatible LLM provider works at runtime — new provider = one config entry + pip install
2. Frontend provider selector with `@lobehub/icons-react` brand icons, model dropdown, runtime API key input
3. Provider health checks with animated status feedback
4. Toast notification system (Base UI primitives)
5. Shared `<ProviderSelector>` component reused on pipeline page AND RAG evaluation page
6. Cleanup: remove Streamlit from compose, fix project name, env-configurable CORS, standardize errors

## Non-Goals

- Auth/authz (capstone demo, no users)
- Circuit breakers / retry policies
- Prompt tuning per provider (test after implementation)
- Embedding provider swaps (SentenceTransformer stays local)

---

## Architecture

### Backend: Provider Registry (`agents/providers.py`)

Single source of truth for all providers. Dynamic import — no hardcoded if/else.

```python
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
        "models": "dynamic",  # fetched live from Ollama API
    },
}
```

### `get_llm()` — Refactored Factory

```python
import importlib

def get_llm(
    provider: str,
    model: str | None = None,
    temperature: float = 0.0,
    api_key: str | None = None,
):
    entry = PROVIDER_REGISTRY[provider]
    mod = importlib.import_module(entry["module"])
    cls = getattr(mod, entry["class"])
    resolved_key = api_key or os.getenv(entry["key_env"] or "", None)
    resolved_model = model or entry["default_model"]
    # Provider-specific kwargs adapter needed:
    # - Ollama: no api_key kwarg, uses base_url instead
    # - Google: uses google_api_key= not api_key=
    # - Anthropic/OpenAI: use api_key=
    kwargs = _build_provider_kwargs(provider, resolved_model, temperature, resolved_key)
    return cls(**kwargs)
```

- New provider = one dict entry + `pip install langchain-<provider>`
- `api_key` param enables runtime key injection from frontend
- Ollama models fetched live from `/api/tags`, others from curated list
- Unknown provider ID → 422 with clear error message

### API Key Flow

- Runtime keys sent per-request via request body
- Backend uses for that call only — never stored, never logged
- Frontend stores in `sessionStorage` per provider — survives navigation, dies on tab close
- Env vars serve as defaults; runtime key overrides env var
- Pydantic field: `api_key: str | None = Field(None, repr=False)`

---

## API Endpoints

### `GET /providers/list`

Returns all registered providers with availability and models.

```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "available": true,
      "requires_key": true,
      "models": [
        {"id": "claude-haiku-4-5-20251001", "name": "Claude Haiku 4.5", "param_size": "-"}
      ],
      "default_model": "claude-haiku-4-5-20251001"
    },
    {
      "id": "ollama",
      "name": "Ollama",
      "available": true,
      "requires_key": false,
      "models": [
        {"id": "llama3.1:latest", "name": "llama3.1:latest", "param_size": "8B"}
      ],
      "default_model": "llama3.1"
    }
  ]
}
```

- `available: true` = env key exists (or Ollama reachable)
- Ollama models fetched live; others from registry curated list

### `GET /providers/{id}/health`

Lightweight provider connectivity check.

```json
{
  "provider": "anthropic",
  "status": "healthy",
  "latency_ms": 342,
  "checked_at": "2026-04-16T14:30:00Z"
}
```

- Anthropic/OpenAI/Google: tiny completion (`max_tokens=1`, cheapest model)
- Ollama: `GET /api/tags` reachability
- Timeout: 5s max
- Accepts optional `X-Provider-Key` header for runtime key health check (not query param — keys in URLs leak into logs)

### `POST /pipeline/run` (modified)

```json
{
  "llm_provider": "openai",
  "llm_model": "gpt-4o-mini",
  "api_key": "sk-..."
}
```

- `api_key` passed through to `get_llm()`, overrides env var for that call
- SSE streaming unchanged

### `POST /rag/evaluate` (modified)

```json
{
  "query": "...",
  "service_context": "redis-cache",
  "top_k": 5,
  "judge_provider": "anthropic",
  "judge_model": "claude-haiku-4-5-20251001",
  "judge_api_key": null
}
```

- Judge provider/model/key params control which LLM scores retrieval quality
- RAG retrieval itself unchanged (SentenceTransformer embeddings, no LLM)

### CORS

```python
ALLOWED_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3001").split(",")
```

### Error Responses (standardized)

All endpoints return errors as:

```json
{"error": "Provider 'foo' not found", "code": "UNKNOWN_PROVIDER"}
```

---

## Frontend

### Dependencies (new)

- `@lobehub/icons-react` — brand icons for providers
- `lucide-animated` — animated wifi icon for health check states

Already present: `@base-ui/react` (toast primitives), `lucide-react` (static icons).

### Provider Display Map (`src/lib/provider-display.ts`)

```ts
import { Anthropic, OpenAI, Google, Ollama } from "@lobehub/icons-react";

const PROVIDER_DISPLAY: Record<string, ProviderDisplay> = {
  anthropic: { icon: Anthropic, color: "#D97757", description: "Claude models" },
  openai:    { icon: OpenAI,    color: "#10A37F", description: "GPT models" },
  google:    { icon: Google,    color: "#4285F4", description: "Gemini models" },
  ollama:    { icon: Ollama,    color: "#FFFFFF", description: "Local models" },
};
```

- Unknown provider ID falls back to generic AI icon + gray color
- One line to add a new provider's icon

### API Key Storage (`src/lib/provider-keys.ts`)

```ts
getStoredKey(providerId: string): string | null    // sessionStorage read
storeKey(providerId: string, key: string): void    // sessionStorage write
clearKey(providerId: string): void                 // sessionStorage remove
```

- Per-provider keys in `sessionStorage`
- Survives page navigation, dies on tab close
- Sent per-request via body, never persisted beyond session

### `<ProviderSelector>` Component

Shared component used on both pipeline and evaluation pages.

```tsx
<ProviderSelector
  value={{ provider: "anthropic", model: "claude-haiku-4-5-20251001" }}
  onChange={({ provider, model }) => ...}
/>
```

Renders:
1. **Provider pills** with lobeicons — dynamic from `/providers/list` response
2. **Model dropdown** — populated from backend response per provider
3. **API key input** — shown when `requires_key && !available` (no env key configured)
4. **Health check status** — `lucide-animated` wifi icon during check, green/red dot after
5. **Lock icon** on providers that have env key pre-configured

### Toast System

Built on Base UI `<Toast>` primitives, styled after t3code pattern.

```
src/components/ui/toast-provider.tsx   — Base UI Toast.Provider at root layout
src/components/ui/toast.tsx            — Styled toast variants (success, error, info)
src/hooks/use-toast.ts                 — imperative: toast.success("Connected to Anthropic")
```

Used by:
- Provider health check results (connected / auth failed / unreachable)
- Pipeline start / complete / error
- Anomaly injection confirmation
- API key saved / cleared feedback

### Services Layer

Replace `src/services/models/` with `src/services/providers/`:

- `schema.ts` — Zod schemas for `/providers/list` and `/providers/{id}/health`
- `query-options.ts` — React Query options for providers list and health checks

### Pages Modified

- **Pipeline page**: `pipeline-controls.tsx` → replace hardcoded PROVIDERS array with `<ProviderSelector>`
- **Evaluation page**: `eval-form.tsx` → add `<ProviderSelector>` for judge LLM selection

---

## Cleanup

| Item | Change |
|------|--------|
| Remove Streamlit from docker-compose | Delete `streamlit-ui` service block |
| Fix project name | `pyproject.toml` name `"teg"` → `"infrawatch-ai"` |
| CORS env-configurable | `CORS_ORIGINS` env var |
| Unify `evaluate_rag.py` | Replace raw Anthropic SDK with `get_llm()` from registry |
| `.gitignore` | Add `.DS_Store`, `.tmp/` |
| Standardize API errors | `{ error, code }` consistently |
| API key security | `repr=False` on Pydantic field, no logging |
| Provider validation | Unknown ID → 422 with clear message |
| Delete `api_backend/routes/models.py` | Replaced by `/providers/list` |
| Delete `frontend/src/services/models/` | Replaced by `src/services/providers/` |

---

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `agents/providers.py` | Provider registry + refactored `get_llm()` |
| `api_backend/routes/providers.py` | `/providers/list` + `/providers/{id}/health` |
| `frontend/src/lib/provider-display.ts` | Icon/color map (lobeicons) |
| `frontend/src/lib/provider-keys.ts` | sessionStorage key helpers |
| `frontend/src/services/providers/schema.ts` | Zod schemas |
| `frontend/src/services/providers/query-options.ts` | React Query options |
| `frontend/src/components/ui/toast-provider.tsx` | Base UI toast provider |
| `frontend/src/components/ui/toast.tsx` | Styled toast variants |
| `frontend/src/hooks/use-toast.ts` | Imperative toast API |
| `frontend/src/components/provider-selector.tsx` | Shared provider+model+key selector |

### Modified Files

| File | Change |
|------|--------|
| `agents/config.py` | Remove `get_llm()`, defaults — moved to `providers.py` |
| `agents/__init__.py` | Import from `providers` |
| `agents/monitor.py` | Accept + pass `api_key` |
| `agents/analyst.py` | Accept + pass `api_key` |
| `agents/responder.py` | Accept + pass `api_key` |
| `agents/graph.py` | Thread `api_key` via `functools.partial` |
| `api_backend/app.py` | CORS from env, mount `/providers`, remove `/models` |
| `api_backend/routes/pipeline.py` | `api_key` field with `repr=False` |
| `api_backend/routes/rag.py` | `judge_provider`, `judge_model`, `judge_api_key` params |
| `scripts/evaluate_rag.py` | Use `get_llm()` from registry, remove raw SDK |
| `frontend/src/app/pipeline/_components/pipeline-controls.tsx` | Use `<ProviderSelector>` |
| `frontend/src/app/evaluation/_components/eval-form.tsx` | Add `<ProviderSelector>` for judge |
| `frontend/src/app/layout.tsx` | Wrap with `<ToastProvider>` |
| `frontend/package.json` | Add `@lobehub/icons-react`, `lucide-animated` |
| `pyproject.toml` | Name → `infrawatch-ai`, add `langchain-openai`, `langchain-google-genai` |
| `docker-compose.yml` | Remove `streamlit-ui` service |
| `.gitignore` | Add `.DS_Store`, `.tmp/` |

### Deleted

| File | Why |
|------|-----|
| `api_backend/routes/models.py` | Replaced by `/providers/list` |
| `frontend/src/services/models/` | Replaced by `src/services/providers/` |

### Untouched

MCP servers, Neo4j graph layer, `graph/`, `services/`, system prompts, LangGraph routing, state schema.
