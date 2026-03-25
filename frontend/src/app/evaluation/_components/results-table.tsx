"use client";

import { motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Network, Layers } from "lucide-react";
import type { RagResult } from "@/services/rag/schema";
import { cn } from "@/lib/utils";

interface ResultsTableProps {
  data: RagResult;
}

function ResultItem({
  item,
  index,
  hasGraphContext,
}: {
  item: Record<string, unknown>;
  index: number;
  hasGraphContext?: boolean;
}) {
  const title = (item.title as string) ?? `Result ${index + 1}`;
  const severity = item.severity as string | undefined;
  const steps = item.steps as string[] | undefined;
  const graphContext = item.graph_context as Record<string, unknown> | undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-secondary/30 rounded-xl p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h4 className="text-sm font-medium leading-snug">{title}</h4>
        {severity && (
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 font-mono text-[10px] uppercase",
              severity === "critical" && "bg-red-500/15 text-red-400",
              severity === "high" && "bg-amber-500/15 text-amber-400",
              severity === "medium" && "bg-blue-500/15 text-blue-400",
              severity === "low" && "bg-emerald-500/15 text-emerald-400",
            )}
          >
            {severity}
          </Badge>
        )}
      </div>

      {steps && steps.length > 0 && (
        <ol className="text-muted-foreground mt-2 space-y-1 pl-4 text-xs">
          {steps.map((step, i) => (
            <li key={i} className="list-decimal leading-relaxed">
              {step}
            </li>
          ))}
        </ol>
      )}

      {typeof item.resolution === "string" && (
        <p className="text-muted-foreground mt-2 text-xs">
          Resolution: {item.resolution}
        </p>
      )}

      {graphContext && hasGraphContext && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/30 pt-3">
          {Object.entries(graphContext).map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 font-mono text-[11px] text-blue-400"
            >
              <Network className="h-3 w-3" />
              {key}: {JSON.stringify(val)}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function ResultColumn({
  title,
  subtitle,
  icon: Icon,
  color,
  items,
  hasGraphContext,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  items: { runbooks: Record<string, unknown>[]; incidents: Record<string, unknown>[] };
  hasGraphContext?: boolean;
}) {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: `${color}15` }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
      </div>

      <ScrollArea className="h-[500px] pr-2">
        <div className="space-y-5">
          {items.runbooks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-muted-foreground/60 text-xs font-medium uppercase tracking-widest">
                Runbooks ({items.runbooks.length})
              </h4>
              {items.runbooks.map((item, i) => (
                <ResultItem key={i} item={item} index={i} hasGraphContext={hasGraphContext} />
              ))}
            </div>
          )}

          {items.incidents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-muted-foreground/60 text-xs font-medium uppercase tracking-widest">
                Incidents ({items.incidents.length})
              </h4>
              {items.incidents.map((item, i) => (
                <ResultItem key={i} item={item} index={i} hasGraphContext={hasGraphContext} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ResultsTable({ data }: ResultsTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="flex gap-6"
    >
      <ResultColumn
        title="GraphRAG"
        subtitle="Topology-aware retrieval"
        icon={Network}
        color="#3b82f6"
        hasGraphContext
        items={{
          runbooks: data.graphrag.runbook_results,
          incidents: data.graphrag.incident_results,
        }}
      />
      <div className="bg-border/50 w-px shrink-0" />
      <ResultColumn
        title="Naive RAG"
        subtitle="Embedding-only retrieval"
        icon={Layers}
        color="#6b7280"
        items={{
          runbooks: data.naive.runbook_results,
          incidents: data.naive.incident_results,
        }}
      />
    </motion.div>
  );
}
