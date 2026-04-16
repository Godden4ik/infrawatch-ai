"""Unit tests for agents/providers.py — provider registry and get_llm factory."""

import importlib
import sys
import types
from unittest.mock import MagicMock, patch

import pytest

# Import providers.py directly without triggering agents/__init__.py
# (which imports langgraph and other heavy deps not needed for unit tests)
import importlib.util
from pathlib import Path

_providers_path = Path(__file__).resolve().parents[3] / "agents" / "providers.py"
_spec = importlib.util.spec_from_file_location("agents.providers", _providers_path)
_mod = importlib.util.module_from_spec(_spec)
sys.modules["agents.providers"] = _mod
_spec.loader.exec_module(_mod)

PROVIDER_REGISTRY = _mod.PROVIDER_REGISTRY
get_llm = _mod.get_llm


# ---------------------------------------------------------------------------
# Helpers: minimal stubs for provider packages that may not be installed
# ---------------------------------------------------------------------------

def _make_anthropic_mock(default_model="claude-haiku-4-5-20251001"):
    mod = types.ModuleType("langchain_anthropic")

    class ChatAnthropic:
        def __init__(self, model, temperature, api_key=None):
            self.model = model
            self.temperature = temperature
            self.api_key = api_key

    mod.ChatAnthropic = ChatAnthropic
    return mod


def _make_openai_mock():
    mod = types.ModuleType("langchain_openai")

    class ChatOpenAI:
        def __init__(self, model, temperature, openai_api_key=None, base_url=None):
            self.model = model
            self.temperature = temperature
            self.openai_api_key = openai_api_key
            self.base_url = base_url

    mod.ChatOpenAI = ChatOpenAI
    return mod


def _make_google_mock():
    mod = types.ModuleType("langchain_google_genai")

    class ChatGoogleGenerativeAI:
        def __init__(self, model, temperature, google_api_key=None):
            self.model = model
            self.temperature = temperature
            self.google_api_key = google_api_key

    mod.ChatGoogleGenerativeAI = ChatGoogleGenerativeAI
    return mod


def _make_ollama_mock():
    mod = types.ModuleType("langchain_ollama")

    class ChatOllama:
        def __init__(self, model, temperature, base_url=None):
            self.model = model
            self.temperature = temperature
            self.base_url = base_url

    mod.ChatOllama = ChatOllama
    return mod


# ---------------------------------------------------------------------------
# Registry structure tests
# ---------------------------------------------------------------------------

class TestProviderRegistry:
    def test_registry_has_all_five_providers(self):

        assert set(PROVIDER_REGISTRY.keys()) >= {"anthropic", "openai", "gemini", "deepseek", "ollama"}

    def test_each_entry_has_required_keys(self):

        required = {"name", "module", "class", "key_env", "default_model", "models"}
        for pid, entry in PROVIDER_REGISTRY.items():
            missing = required - set(entry.keys())
            assert not missing, f"Provider '{pid}' missing keys: {missing}"

    def test_ollama_models_is_dynamic(self):

        assert PROVIDER_REGISTRY["ollama"]["models"] == "dynamic"

    def test_anthropic_has_non_empty_models_list(self):

        models = PROVIDER_REGISTRY["anthropic"]["models"]
        assert isinstance(models, list) and len(models) > 0

    def test_openai_has_non_empty_models_list(self):

        models = PROVIDER_REGISTRY["openai"]["models"]
        assert isinstance(models, list) and len(models) > 0

    def test_google_has_non_empty_models_list(self):

        models = PROVIDER_REGISTRY["gemini"]["models"]
        assert isinstance(models, list) and len(models) > 0

    def test_deepseek_has_non_empty_models_list(self):

        models = PROVIDER_REGISTRY["deepseek"]["models"]
        assert isinstance(models, list) and len(models) > 0


# ---------------------------------------------------------------------------
# get_llm factory tests
# ---------------------------------------------------------------------------

class TestGetLlm:
    def test_returns_anthropic_by_default(self):
        with patch.dict(sys.modules, {"langchain_anthropic": _make_anthropic_mock()}):

            llm = get_llm(provider="anthropic")
            assert type(llm).__name__ == "ChatAnthropic"

    def test_returns_openai(self):
        with patch.dict(sys.modules, {"langchain_openai": _make_openai_mock()}):

            llm = get_llm(provider="openai")
            assert type(llm).__name__ == "ChatOpenAI"

    def test_returns_google(self):
        with patch.dict(sys.modules, {"langchain_google_genai": _make_google_mock()}):

            llm = get_llm(provider="gemini")
            assert type(llm).__name__ == "ChatGoogleGenerativeAI"

    def test_returns_deepseek(self):
        with patch.dict(sys.modules, {"langchain_openai": _make_openai_mock()}):

            llm = get_llm(provider="deepseek")
            assert type(llm).__name__ == "ChatOpenAI"

    def test_returns_ollama(self):
        with patch.dict(sys.modules, {"langchain_ollama": _make_ollama_mock()}):

            llm = get_llm(provider="ollama")
            assert type(llm).__name__ == "ChatOllama"

    def test_unknown_provider_raises_value_error(self):
        with pytest.raises(ValueError, match="Unknown provider"):
            get_llm(provider="nonexistent_provider_xyz")

    # ── Model override ────────────────────────────────────────────────────────

    def test_anthropic_uses_default_model(self):
        with patch.dict(sys.modules, {"langchain_anthropic": _make_anthropic_mock()}):

            llm = get_llm(provider="anthropic")
            assert llm.model == PROVIDER_REGISTRY["anthropic"]["default_model"]

    def test_model_override_anthropic(self):
        with patch.dict(sys.modules, {"langchain_anthropic": _make_anthropic_mock()}):

            llm = get_llm(provider="anthropic", model="claude-opus-4-6")
            assert llm.model == "claude-opus-4-6"

    def test_model_override_ollama(self):
        with patch.dict(sys.modules, {"langchain_ollama": _make_ollama_mock()}):

            llm = get_llm(provider="ollama", model="qwen2.5:14b")
            assert llm.model == "qwen2.5:14b"

    def test_deepseek_uses_default_model(self):
        with patch.dict(sys.modules, {"langchain_openai": _make_openai_mock()}):

            llm = get_llm(provider="deepseek")
            assert llm.model == PROVIDER_REGISTRY["deepseek"]["default_model"]

    # ── Temperature ───────────────────────────────────────────────────────────

    def test_temperature_passed_through_anthropic(self):
        with patch.dict(sys.modules, {"langchain_anthropic": _make_anthropic_mock()}):

            llm = get_llm(provider="anthropic", temperature=0.7)
            assert llm.temperature == 0.7

    def test_temperature_passed_through_ollama(self):
        with patch.dict(sys.modules, {"langchain_ollama": _make_ollama_mock()}):

            llm = get_llm(provider="ollama", temperature=0.5)
            assert llm.temperature == 0.5

    # ── API key handling ──────────────────────────────────────────────────────

    def test_ollama_ignores_api_key(self):
        """Ollama should not receive an api_key argument (uses base_url instead)."""
        with patch.dict(sys.modules, {"langchain_ollama": _make_ollama_mock()}):

            # Should not raise even when api_key is provided
            llm = get_llm(provider="ollama", api_key="sk-should-be-ignored")
            # The stub ChatOllama does not store api_key — confirm it has no such attr
            assert not hasattr(llm, "api_key") or llm.api_key is None

    def test_runtime_api_key_overrides_env_for_anthropic(self):
        with patch.dict(sys.modules, {"langchain_anthropic": _make_anthropic_mock()}):

            llm = get_llm(provider="anthropic", api_key="runtime-key-123")
            assert llm.api_key == "runtime-key-123"

    def test_runtime_api_key_overrides_env_for_openai(self):
        with patch.dict(sys.modules, {"langchain_openai": _make_openai_mock()}):

            llm = get_llm(provider="openai", api_key="openai-runtime-key")
            assert llm.openai_api_key == "openai-runtime-key"

    def test_runtime_api_key_overrides_env_for_deepseek(self):
        with patch.dict(sys.modules, {"langchain_openai": _make_openai_mock()}):

            llm = get_llm(provider="deepseek", api_key="deepseek-runtime-key")
            assert llm.openai_api_key == "deepseek-runtime-key"

    def test_deepseek_uses_default_base_url(self):
        with patch.dict(sys.modules, {"langchain_openai": _make_openai_mock()}):

            llm = get_llm(provider="deepseek")
            assert llm.base_url == "https://api.deepseek.com"
