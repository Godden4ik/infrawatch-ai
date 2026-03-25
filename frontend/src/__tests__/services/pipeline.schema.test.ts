import { describe, it, expect } from "vitest";
import { streamEventSchema, AGENT_ORDER } from "@/services/pipeline/schema";

describe("streamEventSchema", () => {
  it("parses a token event", () => {
    const event = streamEventSchema.parse({
      type: "token",
      agent: "monitor_node",
      content: "Checking metrics...",
    });
    expect(event.type).toBe("token");
    if (event.type === "token") {
      expect(event.content).toBe("Checking metrics...");
    }
  });

  it("parses a tool_start event", () => {
    const event = streamEventSchema.parse({
      type: "tool_start",
      agent: "analyst_node",
      tool: "run_cypher",
    });
    expect(event.type).toBe("tool_start");
  });

  it("parses a tool_end event", () => {
    const event = streamEventSchema.parse({
      type: "tool_end",
      agent: "analyst_node",
      output: "Found 3 dependencies",
    });
    expect(event.type).toBe("tool_end");
  });

  it("parses an agent_complete event", () => {
    const event = streamEventSchema.parse({
      type: "agent_complete",
      agent: "responder_node",
      result: { summary: "restart the service" },
    });
    expect(event.type).toBe("agent_complete");
  });

  it("parses a done event", () => {
    const event = streamEventSchema.parse({ type: "done" });
    expect(event.type).toBe("done");
  });

  it("rejects an unknown event type", () => {
    expect(() =>
      streamEventSchema.parse({ type: "unknown_event" }),
    ).toThrow();
  });

  it("rejects a token event missing content", () => {
    expect(() =>
      streamEventSchema.parse({ type: "token", agent: "x" }),
    ).toThrow();
  });
});

describe("AGENT_ORDER", () => {
  it("contains the three expected agent nodes", () => {
    expect(AGENT_ORDER).toContain("monitor_node");
    expect(AGENT_ORDER).toContain("analyst_node");
    expect(AGENT_ORDER).toContain("responder_node");
  });

  it("is ordered monitor → analyst → responder", () => {
    expect(AGENT_ORDER[0]).toBe("monitor_node");
    expect(AGENT_ORDER[1]).toBe("analyst_node");
    expect(AGENT_ORDER[2]).toBe("responder_node");
  });
});
