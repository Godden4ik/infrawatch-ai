"""Provider registry — dynamic LLM factory supporting multiple backends."""

import importlib
import os
from typing import Any

# ---------------------------------------------------------------------------
# Registry
# ---------------------------------------------------------------------------

PROVIDER_REGISTRY: dict[str, dict[str, Any]] = {
    "anthropic": {
        "name": "Anthropic",
        "module": "langchain_anthropic",
        "class": "ChatAnthropic",
        "key_env": "ANTHROPIC_API_KEY",
        "key_kwarg": "api_key",
        "default_model": "claude-haiku-4-5-20251001",
        "models": [
            "claude-haiku-4-5-20251001",
            "claude-sonnet-4-5",
            "claude-opus-4-5",
            "claude-3-5-haiku-latest",
            "claude-3-5-sonnet-latest",
        ],
    },
    "openai": {
        "name": "OpenAI",
        "module": "langchain_openai",
        "class": "ChatOpenAI",
        "key_env": "OPENAI_API_KEY",
        "key_kwarg": "openai_api_key",
        "default_model": "gpt-4o-mini",
        "models": [
            "gpt-4o-mini",
            "gpt-4o",
            "gpt-4-turbo",
            "o1-mini",
            "o1",
        ],
    },
    "gemini": {
        "name": "Gemini",
        "module": "langchain_google_genai",
        "class": "ChatGoogleGenerativeAI",
        "key_env": "GOOGLE_API_KEY",
        "key_kwarg": "google_api_key",
        "default_model": "gemini-2.0-flash",
        "models": [
            "gemini-2.0-flash",
            "gemini-1.5-flash",
            "gemini-1.5-pro",
        ],
    },
    "deepseek": {
        "name": "DeepSeek",
        "module": "langchain_openai",
        "class": "ChatOpenAI",
        "key_env": "DEEPSEEK_API_KEY",
        "key_kwarg": "openai_api_key",
        "default_model": "deepseek-chat",
        "models": [
            "deepseek-chat",
            "deepseek-reasoner",
        ],
    },
    "ollama": {
        "name": "Ollama",
        "module": "langchain_ollama",
        "class": "ChatOllama",
        "key_env": None,
        "key_kwarg": None,
        "default_model": "llama3.1",
        "models": "dynamic",
    },
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _build_provider_kwargs(
    provider: str,
    model: str,
    temperature: float,
    api_key: str | None,
) -> dict[str, Any]:
    """Build constructor kwargs appropriate for the given provider."""
    entry = PROVIDER_REGISTRY[provider]

    kwargs: dict[str, Any] = {
        "model": model,
        "temperature": temperature,
    }

    if provider == "ollama":
        kwargs["base_url"] = os.getenv("OLLAMA_URL", "http://localhost:11434")
    elif provider == "deepseek":
        kwargs["base_url"] = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
        resolved_key = api_key or (os.getenv(entry["key_env"]) if entry["key_env"] else None)
        if resolved_key is not None:
            kwargs[entry["key_kwarg"]] = resolved_key
    elif entry.get("key_kwarg"):
        resolved_key = api_key or (os.getenv(entry["key_env"]) if entry["key_env"] else None)
        if resolved_key is not None:
            kwargs[entry["key_kwarg"]] = resolved_key

    return kwargs


# ---------------------------------------------------------------------------
# Public factory
# ---------------------------------------------------------------------------

def get_llm(
    provider: str = "anthropic",
    model: str | None = None,
    temperature: float = 0.0,
    api_key: str | None = None,
):
    """Return an LLM instance for agent use.

    Uses dynamic importlib so optional provider packages (langchain_openai,
    langchain_google_genai, etc.) are only imported when actually needed.

    Raises ValueError for unknown provider IDs.
    """
    entry = PROVIDER_REGISTRY.get(provider)
    if entry is None:
        available = ", ".join(sorted(PROVIDER_REGISTRY))
        raise ValueError(f"Unknown provider: {provider}. Available providers: {available}")

    resolved_model = model or entry["default_model"]
    kwargs = _build_provider_kwargs(provider, resolved_model, temperature, api_key)

    module = importlib.import_module(entry["module"])
    cls = getattr(module, entry["class"])
    return cls(**kwargs)
