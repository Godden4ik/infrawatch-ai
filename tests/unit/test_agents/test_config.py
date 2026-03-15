"""Unit tests for agents/config.py LLM factory."""

from unittest.mock import patch

import pytest


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

    def test_returns_ollama(self):
        from agents.config import get_llm
        llm = get_llm(provider="ollama")
        assert type(llm).__name__ == "ChatOllama"

    def test_ollama_uses_default_model(self):
        from agents.config import OLLAMA_DEFAULT_MODEL, get_llm
        llm = get_llm(provider="ollama")
        assert llm.model == OLLAMA_DEFAULT_MODEL

    def test_ollama_model_override(self):
        from agents.config import get_llm
        llm = get_llm(provider="ollama", model="qwen2.5:14b")
        assert llm.model == "qwen2.5:14b"

    def test_temperature_passed_through_anthropic(self):
        from agents.config import get_llm
        llm = get_llm(temperature=0.7)
        assert llm.temperature == 0.7

    def test_temperature_passed_through_ollama(self):
        from agents.config import get_llm
        llm = get_llm(provider="ollama", temperature=0.5)
        assert llm.temperature == 0.5
