"use server";

import { serverFetch, apiBackendUrl } from "@/services/_shared/fetch-server";
import { safeAction } from "@/services/_shared/safe-action";
import type { RagResult } from "./schema";

export async function evaluateRag(
  query: string,
  serviceContext?: string,
  judgeProvider?: string,
  judgeModel?: string,
  judgeApiKey?: string,
) {
  return safeAction(
    () =>
      serverFetch<RagResult>(apiBackendUrl, "/rag/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query,
          service_context: serviceContext ?? null,
          top_k: 5,
          judge_provider: judgeProvider ?? null,
          judge_model: judgeModel ?? null,
          judge_api_key: judgeApiKey ?? null,
        }),
      }),
    { code: "RAG_EVAL_FAILED", message: "Failed to evaluate RAG" },
  );
}
