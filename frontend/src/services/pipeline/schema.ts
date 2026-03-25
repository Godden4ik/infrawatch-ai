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

export const AGENT_ORDER = [
  "monitor",
  "analyst",
  "responder",
] as const;
