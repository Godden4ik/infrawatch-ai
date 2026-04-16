"use client";

import { useState, useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { useQueryClient } from "@tanstack/react-query";
import { ragKeys } from "@/services/rag/query-options";
import type { RagResult } from "@/services/rag/schema";
import { EvalForm } from "./_components/eval-form";
import { ComparisonChart } from "./_components/comparison-chart";
import { ResultsTable } from "./_components/results-table";
import { Card, CardContent } from "@/components/ui/card";
import { FlaskConical, GitCompareArrows, Network, SearchCheck } from "lucide-react";

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub: string;
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 font-mono text-2xl font-semibold leading-none tabular-nums text-foreground">
          {value}
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          {sub}
        </p>
      </CardContent>
    </Card>
  );
}

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

  const graphResultCount =
    (data?.graphrag.runbook_results.length ?? 0) +
    (data?.graphrag.incident_results.length ?? 0);
  const naiveResultCount =
    (data?.naive.runbook_results.length ?? 0) +
    (data?.naive.incident_results.length ?? 0);
  const graphContextCount = data?.graphrag.service_context
    ? Object.keys(data.graphrag.service_context).length
    : 0;
  const queryState = data ? "ready" : "idle";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <motion.div
        className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            RAG Evaluation
          </h1>
          <p className="text-sm text-muted-foreground">
            Compare topology-aware retrieval against embedding-only retrieval
            with the same judge pipeline
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-muted-foreground">
          <div className="bg-card/50 px-3 py-2 ring-1 ring-inset ring-border/70">
            <div className="uppercase tracking-[0.16em]">Modes</div>
            <div className="mt-1 text-sm font-semibold text-foreground">2</div>
          </div>
          <div className="bg-card/50 px-3 py-2 ring-1 ring-inset ring-border/70">
            <div className="uppercase tracking-[0.16em]">Presets</div>
            <div className="mt-1 text-sm font-semibold text-foreground">4</div>
          </div>
          <div className="bg-card/50 px-3 py-2 ring-1 ring-inset ring-border/70">
            <div className="uppercase tracking-[0.16em]">State</div>
            <div className="mt-1 text-sm font-semibold uppercase text-foreground">
              {queryState}
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="GraphRAG Docs"
          value={graphResultCount}
          sub="runbooks + incidents"
        />
        <StatCard
          label="Naive Docs"
          value={naiveResultCount}
          sub="runbooks + incidents"
        />
        <StatCard
          label="Graph Context"
          value={graphContextCount}
          sub={data?.graphrag.service_context ? "context keys attached" : "no service context"}
        />
        <StatCard
          label="Last Query"
          value={currentQuery ? "live" : "idle"}
          sub={currentQuery ? currentQuery.slice(0, 28) : "awaiting compare run"}
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <EvalForm onQueryChange={setCurrentQuery} />
        {data ? (
          <ComparisonChart data={data} />
        ) : (
          <Card className="p-0">
            <CardContent className="flex h-full min-h-[320px] flex-col justify-between p-4">
              <div className="space-y-3">
                <div className="flex h-8 w-8 items-center justify-center bg-primary/10 text-primary ring-1 ring-inset ring-primary/20">
                  <FlaskConical className="h-4 w-4" />
                </div>
                <div className="space-y-1">
                  <h2 className="text-base font-semibold">Run evaluation</h2>
                  <p className="text-sm text-muted-foreground">
                    Submit a query to populate retrieval counts, context lift,
                    and side-by-side evidence panels.
                  </p>
                </div>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <div className="bg-background/40 px-3 py-3 ring-1 ring-inset ring-border/70">
                  <GitCompareArrows className="h-4 w-4 text-primary" />
                  <p className="mt-2 font-mono text-xs text-foreground">
                    Compare two retrieval modes
                  </p>
                </div>
                <div className="bg-background/40 px-3 py-3 ring-1 ring-inset ring-border/70">
                  <SearchCheck className="h-4 w-4 text-primary" />
                  <p className="mt-2 font-mono text-xs text-foreground">
                    Reuse one judge model path
                  </p>
                </div>
                <div className="bg-background/40 px-3 py-3 ring-1 ring-inset ring-border/70">
                  <Network className="h-4 w-4 text-primary" />
                  <p className="mt-2 font-mono text-xs text-foreground">
                    Inspect graph context lift
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {data ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-3"
        >
          <ResultsTable data={data} />
        </motion.div>
      ) : null}
    </div>
  );
}
