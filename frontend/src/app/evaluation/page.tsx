"use client";

import { useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { ragKeys } from "@/services/rag/query-options";
import type { RagResult } from "@/services/rag/schema";
import { EvalForm } from "./_components/eval-form";
import { ComparisonChart } from "./_components/comparison-chart";
import { ResultsTable } from "./_components/results-table";
import { FlaskConical } from "lucide-react";

export default function EvaluationPage() {
  const [currentQuery, setCurrentQuery] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const data = useSyncExternalStore(
    (cb) => queryClient.getQueryCache().subscribe(cb),
    () =>
      currentQuery
        ? queryClient.getQueryData<RagResult>(ragKeys.evaluation(currentQuery))
        : undefined,
    () => undefined,
  );

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <motion.div
        className="space-y-1.5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          RAG Evaluation
        </h1>
        <p className="text-muted-foreground">
          Compare GraphRAG (topology-aware) vs Naive RAG (embedding-only)
          retrieval quality
        </p>
      </motion.div>

      <EvalForm onQueryChange={setCurrentQuery} />

      {data ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          <ComparisonChart data={data} />
          <ResultsTable data={data} />
        </motion.div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="bg-secondary/50 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
            <FlaskConical className="text-muted-foreground/40 h-7 w-7" />
          </div>
          <p className="text-muted-foreground text-base">
            Enter a query and hit Compare to see results
          </p>
          <p className="text-muted-foreground/50 mt-1 text-sm">
            Results will appear as a side-by-side comparison
          </p>
        </div>
      )}
    </div>
  );
}
