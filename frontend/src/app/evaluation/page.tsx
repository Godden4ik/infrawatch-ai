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
import { PageHeader, PageMetaCell } from "@/components/layout/page-header";
import { PageMount } from "@/components/layout/page-mount";
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
    data?.graphrag.metrics?.result_count ??
    (data?.graphrag.runbook_results.length ?? 0) +
      (data?.graphrag.incident_results.length ?? 0);
  const naiveResultCount =
    data?.naive.metrics?.result_count ??
    (data?.naive.runbook_results.length ?? 0) +
      (data?.naive.incident_results.length ?? 0);
  const graphContextCount =
    data?.graphrag.metrics?.context_richness ??
    (data?.graphrag.service_context ? Object.keys(data.graphrag.service_context).length : 0);
  const queryState = data ? "ready" : "idle";

  return (
    <PageMount className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title="RAG Evaluation"
        description="Compare topology-aware retrieval against embedding-only retrieval with the same judge pipeline"
        meta={
          <>
            <PageMetaCell label="Modes" value="2" />
            <PageMetaCell label="Presets" value="4" />
            <PageMetaCell
              label="State"
              value={<span className="uppercase">{queryState}</span>}
            />
          </>
        }
      />

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
          sub={
            data?.graphrag.service_context || data?.graphrag.metrics
              ? "context fields attached"
              : "no service context"
          }
        />
        <StatCard
          label="Judge"
          value={data?.judge_provider ?? "idle"}
          sub={data?.judge_model ?? "awaiting compare run"}
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
    </PageMount>
  );
}
