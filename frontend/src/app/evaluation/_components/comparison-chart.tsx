"use client";

import { motion } from "motion/react";
import type { RagResult } from "@/services/rag/schema";
import { Network, FileText, AlertTriangle, Database } from "lucide-react";

interface ComparisonChartProps {
  data: RagResult;
}

interface MetricCardProps {
  label: string;
  graphrag: number;
  naive: number;
  icon: React.ElementType;
  unit?: string;
  delay: number;
}

function MetricCard({ label, graphrag, naive, icon: Icon, unit = "", delay }: MetricCardProps) {
  const winner = graphrag > naive ? "graphrag" : graphrag === naive ? "tie" : "naive";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
      className="bg-secondary/30 rounded-xl p-5"
    >
      <div className="mb-4 flex items-center gap-2.5">
        <Icon className="text-muted-foreground h-4.5 w-4.5" />
        <span className="text-muted-foreground text-sm font-medium">
          {label}
        </span>
      </div>
      <div className="flex gap-6">
        {/* GraphRAG */}
        <div className="flex-1">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-bold tabular-nums text-blue-400">
              {graphrag}
            </span>
            {unit && <span className="text-muted-foreground text-sm">{unit}</span>}
          </div>
          <div className="mb-1.5 h-2 w-full overflow-hidden rounded-full bg-blue-500/10">
            <motion.div
              className="h-full rounded-full bg-blue-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (graphrag / Math.max(graphrag, naive, 1)) * 100)}%` }}
              transition={{ duration: 0.6, delay: delay + 0.2 }}
            />
          </div>
          <span className="text-xs text-blue-400">GraphRAG</span>
        </div>
        {/* Naive */}
        <div className="flex-1">
          <div className="mb-2 flex items-baseline gap-2">
            <span className="text-muted-foreground font-mono text-3xl font-bold tabular-nums">
              {naive}
            </span>
            {unit && <span className="text-muted-foreground text-sm">{unit}</span>}
          </div>
          <div className="bg-muted mb-1.5 h-2 w-full overflow-hidden rounded-full">
            <motion.div
              className="bg-muted-foreground/40 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (naive / Math.max(graphrag, naive, 1)) * 100)}%` }}
              transition={{ duration: 0.6, delay: delay + 0.2 }}
            />
          </div>
          <span className="text-muted-foreground text-xs">Naive RAG</span>
        </div>
      </div>
    </motion.div>
  );
}

export function ComparisonChart({ data }: ComparisonChartProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <MetricCard
        label="Runbooks Retrieved"
        graphrag={data.graphrag.runbook_results.length}
        naive={data.naive.runbook_results.length}
        icon={FileText}
        delay={0}
      />
      <MetricCard
        label="Incidents Retrieved"
        graphrag={data.graphrag.incident_results.length}
        naive={data.naive.incident_results.length}
        icon={AlertTriangle}
        delay={0.08}
      />
      <MetricCard
        label="Has Service Context"
        graphrag={data.graphrag.service_context ? 1 : 0}
        naive={0}
        icon={Network}
        unit={data.graphrag.service_context ? "yes" : "no"}
        delay={0.16}
      />
    </div>
  );
}
