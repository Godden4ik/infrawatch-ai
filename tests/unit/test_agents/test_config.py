"""Unit tests for agents/config.py LLM factory."""

import sys
import types
from unittest.mock import MagicMock, patch

import pytest


def _make_ollama_mock():
    """Return a minimal langchain_ollama stub with a ChatOllama class."""
    mock_module = types.ModuleType("langchain_ollama")

    class ChatOllama:
        def __init__(self, model, temperature):
            self.model = model
            self.temperature = temperature

    mock_module.ChatOllama = ChatOllama
    return mock_module


class TestGetLlm:
    def test_returns_anthropic_by_default(self):
        from agents.config import get_llm
        llm = get_llm()
        assert type(llm).__name__ == "ChatAnthropic"

    def test_returns_anthropic_explicitly(self):
        from agents.config import get_llm
        llm = get_llm(provider="anthropic")
        assert type(llm).__name__ == "ChatAnthropic"

    def test_anthropic_uses_default_model(self):
        from agents.config import ANTHROPIC_DEFAULT_MODEL, get_llm
        llm = get_llm(provider="anthropic")
        assert llm.model == ANTHROPIC_DEFAULT_MODEL

    def test_anthropic_model_override(self):
        from agents.config import get_llm
        llm = get_llm(provider="anthropic", model="claude-opus-4-6")
        assert llm.model == "claude-opus-4-6"

    def test_temperature_passed_through_anthropic(self):
        from agents.config import get_llm
        llm = get_llm(temperature=0.7)
        assert llm.temperature == 0.7

    # ── Ollama tests (langchain_ollama is an optional dependency) ──────────

    def test_returns_ollama(self):
        with patch.dict(sys.modules, {"langchain_ollama": _make_ollama_mock()}):
            from agents.config import get_llm
            llm = get_llm(provider="ollama")
            assert type(llm).__name__ == "ChatOllama"

    def test_ollama_uses_default_model(self):
        with patch.dict(sys.modules, {"langchain_ollama": _make_ollama_mock()}):
            from agents.config import OLLAMA_DEFAULT_MODEL, get_llm
            llm = get_llm(provider="ollama")
            assert llm.model == OLLAMA_DEFAULT_MODEL

    def test_ollama_model_override(self):
        with patch.dict(sys.modules, {"langchain_ollama": _make_ollama_mock()}):
            from agents.config import get_llm
            llm = get_llm(provider="ollama", model="qwen2.5:14b")
            assert llm.model == "qwen2.5:14b"

    def test_temperature_passed_through_ollama(self):
        with patch.dict(sys.modules, {"langchain_ollama": _make_ollama_mock()}):
            from agents.config import get_llm
            llm = get_llm(provider="ollama", temperature=0.5)
            assert llm.temperature == 0.5
