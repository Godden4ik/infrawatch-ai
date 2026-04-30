import { describe, expect, it } from "vitest";
import { ragResultSchema } from "@/services/rag/schema";

describe("ragResultSchema", () => {
  it("parses metrics and judge metadata", () => {
    const result = ragResultSchema.parse({
      query: "redis down",
      judge_provider: "anthropic",
      judge_model: "claude-haiku-4-5-20251001",
      content_overlap: 0.8,
      graphrag: {
        runbook_results: [{ runbook_id: "RB-001", runbook_title: "Redis recovery" }],
        incident_results: [],
        service_context: { service: "redis-cache" },
        metrics: {
          result_count: 1,
          context_richness: 3,
          services_found: ["redis-cache"],
          llm_content_relevance: 9,
          llm_actionability: 8,
        },
      },
      naive: {
        runbook_results: [],
        incident_results: [],
        metrics: {
          result_count: 0,
          context_richness: 0,
          services_found: [],
          llm_content_relevance: 6,
          llm_actionability: 5,
        },
      },
    });

    expect(result.graphrag.metrics?.llm_content_relevance).toBe(9);
    expect(result.judge_provider).toBe("anthropic");
    expect(result.content_overlap).toBe(0.8);
  });
});
