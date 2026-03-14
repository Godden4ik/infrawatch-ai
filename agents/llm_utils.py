"""Shared tool-calling loop helper for agent nodes."""

import logging

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool

logger = logging.getLogger(__name__)


async def run_agent_with_tools(
    llm: ChatAnthropic,
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
            messages.append(
                ToolMessage(content=str(result), tool_call_id=tc["id"])
            )
    else:
        # Loop exhausted max_tool_rounds — last message is a ToolMessage.
        # Do one final LLM call so the agent can produce its text summary.
        logger.info("  max_tool_rounds reached — making final summary call")
        response = await bound_llm.ainvoke(messages)
        messages.append(response)

    final_content = messages[-1].content if messages else ""
    if isinstance(final_content, list):
        # Anthropic sometimes returns content as list of blocks
        final_content = "\n".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in final_content
        )
    return messages, final_content
