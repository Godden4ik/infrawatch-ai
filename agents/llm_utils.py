"""Shared tool-calling loop helper for agent nodes."""

from langchain_anthropic import ChatAnthropic
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage, ToolMessage
from langchain_core.tools import BaseTool


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

    for _ in range(max_tool_rounds):
        response: AIMessage = await bound_llm.ainvoke(messages)
        messages.append(response)

        if not response.tool_calls:
            break

        for tc in response.tool_calls:
            tool = tool_map.get(tc["name"])
            if tool is None:
                result = f"Error: unknown tool '{tc['name']}'"
            else:
                result = await tool.ainvoke(tc["args"])
            messages.append(
                ToolMessage(content=str(result), tool_call_id=tc["id"])
            )

    final_content = messages[-1].content if messages else ""
    if isinstance(final_content, list):
        # Anthropic sometimes returns content as list of blocks
        final_content = "\n".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in final_content
        )
    return messages, final_content
