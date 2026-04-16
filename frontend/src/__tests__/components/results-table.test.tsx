import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResultsTable } from "@/app/evaluation/_components/results-table";
import type { RagResult } from "@/services/rag/schema";

describe("ResultsTable", () => {
  it("renders runbook title and content from retrieval payload", () => {
    const data: RagResult = {
      query: "redis down",
      judge_provider: "anthropic",
      judge_model: "claude-haiku-4-5-20251001",
      content_overlap: 1,
      graphrag: {
        runbook_results: [
          {
            runbook_id: "RB-001",
            runbook_title: "Redis Cache Failure Recovery",
            step_title: "Recover Redis primary",
            content: "Check pod health and flush stale keys if memory exceeds 90%.",
            severity: "critical",
            applies_to_services: ["redis-cache"],
          },
        ],
        incident_results: [],
        service_context: { service: "redis-cache" },
        metrics: {
          result_count: 1,
          context_richness: 1,
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
          llm_content_relevance: 5,
          llm_actionability: 5,
        },
      },
    };

    render(<ResultsTable data={data} />);

    expect(screen.getByText("Redis Cache Failure Recovery")).toBeInTheDocument();
    expect(screen.getByText("RB-001")).toBeInTheDocument();
    expect(screen.getByText("Step: Recover Redis primary")).toBeInTheDocument();
    expect(
      screen.getByText("Check pod health and flush stale keys if memory exceeds 90%."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Result 1")).not.toBeInTheDocument();
  });
});
