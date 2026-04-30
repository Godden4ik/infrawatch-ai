"""Shared tool-calling loop helper for agent nodes."""

import logging
import re
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool

logger = logging.getLogger(__name__)


_TOOL_RESULT_MAX_CHARS = 3000  # truncate tool results to keep context small


def sanitize_tool_output(content: Any) -> str:
    """Sanitize untrusted tool output before injecting it into LLM context.

    Preserve JSON parseability for downstream components that inspect tool
    outputs from message history.
    """
    raw = str(content)
    trimmed = raw.lstrip()
    looks_like_json = trimmed.startswith("{") or trimmed.startswith("[")

    sanitized = raw.replace("```", "'''")
    sanitized = re.sub(
        r"(?i)\b(system|developer|user|assistant)\s*:",
        lambda m: f"{m.group(1)}_(untrusted):",
        sanitized,
    )
    sanitized = re.sub(
        r"(?i)\b(ignore previous instructions|disregard previous instructions|override your instructions)\b",
        "[UNTRUSTED_INSTRUCTION_IGNORED]",
        sanitized,
    )
    sanitized = re.sub(
        r"(?i)\b(you must obey|follow these instructions exactly)\b",
        "[UNTRUSTED_INSTRUCTION_IGNORED]",
        sanitized,
    )

    if looks_like_json:
        return sanitized
    return f"<<TOOL_OUTPUT_DATA>>\n{sanitized}\n<</TOOL_OUTPUT_DATA>>"


async def run_agent_with_tools(
    llm: BaseChatModel,
    tools: list[BaseTool],
    system_prompt: str,
    human_message: str,
    max_tool_rounds: int = 5,
) -> tuple[list[BaseMessage], str]:
    """Run an LLM with tools until it produces a final text response.

    Returns (all_messages, final_content_string).
    """
    bound_llm = llm.bind_tools(tools) if tools else llm
    tool_map = {t.name: t for t in tools}

    messages: list[BaseMessage] = [
        SystemMessage(content=system_prompt),
        HumanMessage(content=human_message),
    ]

    for round_num in range(max_tool_rounds):
        response: AIMessage = await bound_llm.ainvoke(messages)
        messages.append(response)

        if not response.tool_calls:
            logger.debug("  No tool calls — agent finished after %d round(s)", round_num + 1)
            break

        tool_names = [tc["name"] for tc in response.tool_calls]
        logger.info("  Round %d: calling %s", round_num + 1, ", ".join(tool_names))

        for tc in response.tool_calls:
            tool = tool_map.get(tc["name"])
            args_summary = ", ".join(f"{k}={v!r}" for k, v in tc["args"].items()) or "(no args)"
            if tool is None:
                result = f"Error: unknown tool '{tc['name']}'"
                logger.warning("  [TOOL] %s(%s) → unknown tool", tc["name"], args_summary)
            else:
                result = await tool.ainvoke(tc["args"])
                result_preview = str(result)[:120].replace("\n", " ")
                logger.info("  [TOOL] %s(%s) → %s…", tc["name"], args_summary, result_preview)
            result_str = sanitize_tool_output(result)
            if len(result_str) > _TOOL_RESULT_MAX_CHARS:
                result_str = result_str[:_TOOL_RESULT_MAX_CHARS] + "\n[truncated]"
            messages.append(
                ToolMessage(content=result_str, tool_call_id=tc["id"])
            )
    else:
        # Loop exhausted max_tool_rounds — last message is a ToolMessage.
        # Inject an explicit instruction then make one final non-tool LLM call.
        logger.info("  max_tool_rounds reached — making final summary call")
        messages.append(HumanMessage(
            content=(
                "You have reached the tool call limit. "
                "Do NOT call any more tools. "
                "Using only the information already retrieved above, "
                "produce your final response now including the required JSON block."
            )
        ))
        # Use base LLM (no tools bound) so it cannot emit tool_calls
        final_response = await llm.ainvoke(messages)
        messages.append(final_response)

    final_content = messages[-1].content if messages else ""
    if isinstance(final_content, list):
        # Anthropic sometimes returns content as list of blocks
        final_content = "\n".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in final_content
        )
    return messages, final_content
