"""Unit tests for agents/config.py — logging setup, MCP server registry, paths."""

import pytest


class TestMcpServers:
    def test_has_three_entries(self):
        from agents.config import MCP_SERVERS
        assert len(MCP_SERVERS) == 3

    def test_has_expected_keys(self):
        from agents.config import MCP_SERVERS
        assert set(MCP_SERVERS.keys()) == {"prometheus", "grafana", "neo4j"}

    def test_all_use_stdio_transport(self):
        from agents.config import MCP_SERVERS
        for name, cfg in MCP_SERVERS.items():
            assert cfg.get("transport") == "stdio", f"'{name}' does not use stdio transport"

    def test_all_have_command_and_args(self):
        from agents.config import MCP_SERVERS
        for name, cfg in MCP_SERVERS.items():
            assert "command" in cfg, f"'{name}' missing 'command'"
            assert "args" in cfg and len(cfg["args"]) > 0, f"'{name}' missing 'args'"


class TestProjectRoot:
    def test_project_root_exists(self):
        from agents.config import PROJECT_ROOT
        assert PROJECT_ROOT.exists(), f"PROJECT_ROOT {PROJECT_ROOT} does not exist"

    def test_project_root_contains_agents(self):
        from agents.config import PROJECT_ROOT
        assert (PROJECT_ROOT / "agents").is_dir()
