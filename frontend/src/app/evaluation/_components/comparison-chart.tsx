"use client";

import { motion } from "motion/react";
import type { RagResult } from "@/services/rag/schema";
import { Card, CardContent } from "@/components/ui/card";
import { StatusPill } from "@/components/ui/status-indicator";
import { Network, FileText, AlertTriangle, GitCompareArrows } from "lucide-react";
import { cn } from "@/lib/utils";

interface ComparisonChartProps {
  data: RagResult;
}

interface MetricCardProps {
  label: string;
  graphrag: number;
  naive: number;
  icon: React.ElementType;
  delay: number;
  hint: string;
}

function MetricCard({
  label,
  graphrag,
  naive,
  icon: Icon,
  delay,
  hint,
}: MetricCardProps) {
  const maxValue = Math.max(graphrag, naive, 1);
  const graphWidth = `${(graphrag / maxValue) * 100}%`;
  const naiveWidth = `${(naive / maxValue) * 100}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="h-full p-0">
        <CardContent className="space-y-4 p-3">
          <div className="flex items-center gap-2.5">
            <Icon className="h-4 w-4 text-brand" />
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="font-mono text-[10px] text-muted-foreground">
                {hint}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-brand">
                  GraphRAG
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {graphrag}
                </span>
              </div>
              <div className="h-1.5 bg-brand-soft">
                <motion.div
                  className="h-full bg-brand"
                  initial={{ width: 0 }}
                  animate={{ width: graphWidth }}
                  transition={{ duration: 0.55, delay: delay + 0.15 }}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                  Naive
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {naive}
                </span>
              </div>
              <div className="h-1.5 bg-muted/70">
                <motion.div
                  className="h-full bg-muted-foreground/55"
                  initial={{ width: 0 }}
                  animate={{ width: naiveWidth }}
                  transition={{ duration: 0.55, delay: delay + 0.15 }}
                />
              </div>
            </div>
          </div>

          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Delta {graphrag - naive >= 0 ? "+" : ""}
            {graphrag - naive}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ComparisonChart({ data }: ComparisonChartProps) {
  const graphMetrics = data.graphrag.metrics;
  const naiveMetrics = data.naive.metrics;
  const graphTotal =
    graphMetrics?.result_count ??
    data.graphrag.runbook_results.length + data.graphrag.incident_results.length;
  const naiveTotal =
    naiveMetrics?.result_count ??
    data.naive.runbook_results.length + data.naive.incident_results.length;
  const graphContextCount =
    graphMetrics?.context_richness ??
    (data.graphrag.service_context ? Object.keys(data.graphrag.service_context).length : 0);
  const naiveContextCount = naiveMetrics?.context_richness ?? 0;
  const graphJudgeRelevance = graphMetrics?.llm_content_relevance ?? 0;
  const naiveJudgeRelevance = naiveMetrics?.llm_content_relevance ?? 0;
  const graphJudgeActionability = graphMetrics?.llm_actionability ?? 0;
  const naiveJudgeActionability = naiveMetrics?.llm_actionability ?? 0;
  const overlap = data.content_overlap ?? 0;

  const graphRelevanceWin = graphJudgeRelevance > naiveJudgeRelevance;
  const graphActionWin = graphJudgeActionability > naiveJudgeActionability;
  const tieRelevance = graphJudgeRelevance === naiveJudgeRelevance;
  const tieAction = graphJudgeActionability === naiveJudgeActionability;
  const overallTie = tieRelevance && tieAction;
  const overallGraphWin =
    graphJudgeRelevance + graphJudgeActionability >
    naiveJudgeRelevance + naiveJudgeActionability;
  const outcomeVariant: "healthy" | "unknown" | "degraded" = overallTie
    ? "unknown"
    : overallGraphWin
    ? "healthy"
    : "degraded";
  const outcomeLabel = overallTie
    ? "Tie"
    : overallGraphWin
    ? "GraphRAG wins"
    : "Naive wins";

  return (
    <Card className="h-full p-0">
      <CardContent className="border-b border-border/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Comparison Summary</h2>
            <p className="text-sm text-muted-foreground">
              Output counts and graph-context lift for current evaluation run.
            </p>
          </div>
          <StatusPill variant={outcomeVariant}>{outcomeLabel}</StatusPill>
        </div>
      </CardContent>

      <CardContent className="space-y-4 p-4">
        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Judge Scores
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <JudgeScorePair
              label="Content Relevance"
              graphrag={graphJudgeRelevance}
              naive={naiveJudgeRelevance}
              graphWins={graphRelevanceWin}
              tied={tieRelevance}
            />
            <JudgeScorePair
              label="Actionability"
              graphrag={graphJudgeActionability}
              naive={naiveJudgeActionability}
              graphWins={graphActionWin}
              tied={tieAction}
            />
          </div>
        </div>

        <div>
          <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
            Retrieval Volume <span className="text-muted-foreground/60">· overlap {overlap.toFixed(2)}</span>
          </p>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
            <MetricCard
              label="Runbooks"
              graphrag={data.graphrag.runbook_results.length}
              naive={data.naive.runbook_results.length}
              icon={FileText}
              delay={0}
              hint="retrieved procedures"
            />
            <MetricCard
              label="Incidents"
              graphrag={data.graphrag.incident_results.length}
              naive={data.naive.incident_results.length}
              icon={AlertTriangle}
              delay={0.08}
              hint="retrieved historical events"
            />
            <MetricCard
              label="Total Evidence"
              graphrag={graphTotal}
              naive={naiveTotal}
              icon={GitCompareArrows}
              delay={0.16}
              hint="combined result volume"
            />
            <MetricCard
              label="Graph Context"
              graphrag={graphContextCount}
              naive={naiveContextCount}
              icon={Network}
              delay={0.24}
              hint="attached context keys"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function JudgeScorePair({
  label,
  graphrag,
  naive,
  graphWins,
  tied,
}: {
  label: string;
  graphrag: number;
  naive: number;
  graphWins: boolean;
  tied: boolean;
}) {
  return (
    <div className="bg-background/40 px-3 py-3 ring-1 ring-inset ring-border/70">
      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
        {label}
      </p>
      <div className="mt-2 flex items-end gap-4">
        <div className="space-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            GraphRAG
          </p>
          <p
            className={cn(
              "text-2xl font-semibold leading-none tabular-nums tracking-tight",
              graphWins && !tied ? "text-brand" : "text-foreground",
            )}
          >
            {graphrag}
            <span className="ml-1 font-mono text-[10px] font-normal tracking-normal text-muted-foreground">
              /10
            </span>
          </p>
        </div>
        <div className="h-6 w-px bg-border/60" />
        <div className="space-y-0.5">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            Naive
          </p>
          <p
            className={cn(
              "text-2xl font-semibold leading-none tabular-nums tracking-tight",
              !graphWins && !tied ? "text-foreground" : "text-foreground",
            )}
          >
            {naive}
            <span className="ml-1 font-mono text-[10px] font-normal tracking-normal text-muted-foreground">
              /10
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
