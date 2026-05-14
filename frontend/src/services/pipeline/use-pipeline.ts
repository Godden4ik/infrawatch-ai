"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClientStream } from "@/services/_shared/fetch-client";
import { pipelineKeys } from "./query-options";
import {
  normalizeAgentName,
  type PipelineRunParams,
  type PipelineState,
  type StreamEvent,
} from "./schema";

const INITIAL_STATE: PipelineState = {
  status: "idle",
  agents: {},
};

function mergeEvent(
  state: PipelineState,
  event: StreamEvent,
): PipelineState {
  if (event.type === "done") {
    return state.status === "error" ? state : { ...state, status: "complete" };
  }

  if (event.type === "error") {
    return {
      ...state,
      status: "error",
      error: event.message,
    };
  }

  const agent = "agent" in event ? normalizeAgentName(event.agent) : "";
  const prev = state.agents[agent] ?? { tokens: "", toolCalls: [] };

  switch (event.type) {
    case "token":
      return {
        ...state,
        status: "running",
        agents: {
          ...state.agents,
          [agent]: { ...prev, tokens: prev.tokens + event.content },
        },
      };
    case "tool_start":
      return {
        ...state,
        status: "running",
        agents: {
          ...state.agents,
          [agent]: {
            ...prev,
            toolCalls: [...prev.toolCalls, { tool: event.tool }],
          },
        },
      };
    case "tool_end":
      return {
        ...state,
        status: "running",
        agents: {
          ...state.agents,
          [agent]: {
            ...prev,
            toolCalls: prev.toolCalls.map((tc, i) =>
              i === prev.toolCalls.length - 1
                ? { ...tc, output: event.output }
                : tc,
            ),
          },
        },
      };
    case "agent_complete":
      return {
        ...state,
        status: "running",
        agents: {
          ...state.agents,
          [agent]: { ...prev, result: event.result },
        },
      };
    default:
      return state;
  }
}

export function usePipelineStream() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: PipelineRunParams) => {
      queryClient.setQueryData(pipelineKeys.lastParams(), params);
      queryClient.setQueryData(pipelineKeys.currentRun(), INITIAL_STATE);

      const res = await apiClientStream("/api/pipeline/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          llm_provider: params.llmProvider ?? "anthropic",
          llm_model: params.llmModel ?? null,
          api_key: params.apiKey ?? null,
        }),
      });

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let terminated = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6);
          try {
            const event = JSON.parse(json) as StreamEvent;
            if (event.type === "done" || event.type === "error") {
              terminated = true;
            }
            queryClient.setQueryData(
              pipelineKeys.currentRun(),
              (old: PipelineState | undefined) =>
                mergeEvent(old ?? INITIAL_STATE, event),
            );
          } catch {
            // skip malformed events
          }
        }
      }

      if (!terminated) {
        throw new Error("Stream disconnected before completion");
      }
    },
    onError: (error) => {
      queryClient.setQueryData(
        pipelineKeys.currentRun(),
        (old: PipelineState | undefined) => ({
          ...(old ?? INITIAL_STATE),
          status: "error" as const,
          error: error.message,
        }),
      );
    },
  });
}
