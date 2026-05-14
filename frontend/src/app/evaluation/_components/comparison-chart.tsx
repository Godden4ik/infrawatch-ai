"use client";

import { motion } from "motion/react";
import type { RagResult } from "@/services/rag/schema";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
            <Icon className="h-4 w-4 text-primary" />
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
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-primary">
                  GraphRAG
                </span>
                <span className="font-mono text-sm font-semibold tabular-nums text-foreground">
                  {graphrag}
                </span>
              </div>
              <div className="h-1.5 bg-primary/10">
                <motion.div
                  className="h-full bg-primary"
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
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.16em]",
              graphJudgeRelevance >= naiveJudgeRelevance
                ? "border-primary/30 bg-primary/10 text-primary"
                : "border-border text-muted-foreground",
            )}
          >
            <GitCompareArrows className="mr-1 h-3 w-3" />
            {graphJudgeRelevance >= naiveJudgeRelevance ? "judge scored" : "parity"}
          </Badge>
        </div>
      </CardContent>

      <CardContent className="space-y-3 p-4">
        <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-6">
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
          <MetricCard
            label="Judge Relevance"
            graphrag={graphJudgeRelevance}
            naive={naiveJudgeRelevance}
            icon={GitCompareArrows}
            delay={0.32}
            hint="LLM content score"
          />
          <MetricCard
            label="Judge Action"
            graphrag={graphJudgeActionability}
            naive={naiveJudgeActionability}
            icon={AlertTriangle}
            delay={0.4}
            hint={`LLM actionability • overlap ${overlap.toFixed(2)}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
