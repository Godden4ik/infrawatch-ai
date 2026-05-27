import { z } from "zod";

export const streamEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("token"),
    agent: z.string(),
    content: z.string(),
  }),
  z.object({
    type: z.literal("tool_start"),
    agent: z.string(),
    tool: z.string(),
  }),
  z.object({
    type: z.literal("tool_end"),
    agent: z.string(),
    output: z.string(),
  }),
  z.object({
    type: z.literal("agent_complete"),
    agent: z.string(),
    result: z.record(z.string(), z.unknown()),
  }),
  z.object({
    type: z.literal("done"),
  }),
  z.object({
    type: z.literal("error"),
    message: z.string(),
  }),
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;

export type PipelineState = {
  status: "idle" | "running" | "complete" | "error";
  agents: Record<
    string,
    {
      tokens: string;
      toolCalls: Array<{ tool: string; output?: string }>;
      result?: Record<string, unknown>;
    }
  >;
  error?: string;
};

export type PipelineRunParams = {
  llmProvider?: string;
  llmModel?: string;
  apiKey?: string;
};

export type TransportStatus = "connecting" | "streaming" | "complete" | "error";

export function deriveTransportStatus(
  state: PipelineState | undefined,
  isPending: boolean,
): TransportStatus {
  if (state?.status === "error") return "error";
  if (state?.status === "complete") return "complete";
  if (state?.status === "running") return "streaming";
  if (isPending) return "connecting";
  return "connecting";
}

export const AGENT_ORDER = [
  "monitor_node",
  "analyst_node",
  "responder_node",
] as const;

export const AGENT_ALIASES = {
  monitor: "monitor_node",
  analyst: "analyst_node",
  responder: "responder_node",
  monitor_node: "monitor_node",
  analyst_node: "analyst_node",
  responder_node: "responder_node",
} as const;

export function normalizeAgentName(agent: string) {
  return AGENT_ALIASES[agent as keyof typeof AGENT_ALIASES] ?? agent;
}
