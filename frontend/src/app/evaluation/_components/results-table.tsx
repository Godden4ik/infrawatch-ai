"use client";

import { motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
      className="space-y-2 border border-border/60 bg-background/40 p-3"
    >
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-medium leading-snug">{title}</h4>
        {severity && (
          <Badge
            variant="outline"
            className={cn(
              "shrink-0 font-mono text-[10px] uppercase tracking-[0.16em]",
              severity === "critical" &&
                "border-destructive/30 bg-destructive/10 text-destructive",
              severity === "high" &&
                "border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]",
              severity === "medium" &&
                "border-primary/30 bg-primary/10 text-primary",
              severity === "low" &&
                "border-[color:var(--color-success)]/30 bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]",
            )}
          >
            {severity}
          </Badge>
        )}
      </div>

      {steps && steps.length > 0 && (
        <ol className="space-y-1 pl-4 text-xs text-muted-foreground">
          {steps.map((step, i) => (
            <li key={i} className="list-decimal leading-relaxed">
              {step}
            </li>
          ))}
        </ol>
      )}

      {typeof item.resolution === "string" && (
        <p className="text-xs text-muted-foreground">
          Resolution: {item.resolution}
        </p>
      )}

      {graphContext && hasGraphContext && (
        <div className="flex flex-wrap gap-2 border-t border-border/40 pt-3">
          {Object.entries(graphContext).map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 border border-primary/20 bg-primary/10 px-2 py-1 font-mono text-[11px] text-primary"
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
  tone,
  items,
  hasGraphContext,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  tone: "primary" | "muted";
  items: { runbooks: Record<string, unknown>[]; incidents: Record<string, unknown>[] };
  hasGraphContext?: boolean;
}) {
  const totalCount = items.runbooks.length + items.incidents.length;

  return (
    <Card className="min-h-[620px] p-0">
      <CardContent className="border-b border-border/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-8 w-8 items-center justify-center ring-1 ring-inset",
                tone === "primary"
                  ? "bg-primary/10 text-primary ring-primary/20"
                  : "bg-muted/60 text-muted-foreground ring-border",
              )}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {totalCount} docs
          </div>
        </div>
      </CardContent>

      <CardContent className="p-0">
        <ScrollArea className="h-[560px]">
          <div className="space-y-5 p-4">
            {items.runbooks.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Runbooks ({items.runbooks.length})
                </h4>
                {items.runbooks.map((item, i) => (
                  <ResultItem
                    key={i}
                    item={item}
                    index={i}
                    hasGraphContext={hasGraphContext}
                  />
                ))}
              </div>
            )}

            {items.runbooks.length > 0 && items.incidents.length > 0 ? (
              <Separator />
            ) : null}

            {items.incidents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  Incidents ({items.incidents.length})
                </h4>
                {items.incidents.map((item, i) => (
                  <ResultItem
                    key={i}
                    item={item}
                    index={i}
                    hasGraphContext={hasGraphContext}
                  />
                ))}
              </div>
            )}

            {totalCount === 0 ? (
              <div className="flex min-h-40 items-center justify-center border border-dashed border-border/70 bg-background/30 px-4 text-center font-mono text-xs text-muted-foreground">
                No evidence retrieved.
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export function ResultsTable({ data }: ResultsTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="grid gap-3 xl:grid-cols-2"
    >
      <ResultColumn
        title="GraphRAG"
        subtitle="Topology-aware retrieval"
        icon={Network}
        tone="primary"
        hasGraphContext
        items={{
          runbooks: data.graphrag.runbook_results,
          incidents: data.graphrag.incident_results,
        }}
      />
      <ResultColumn
        title="Naive RAG"
        subtitle="Embedding-only retrieval"
        icon={Layers}
        tone="muted"
        items={{
          runbooks: data.naive.runbook_results,
          incidents: data.naive.incident_results,
        }}
      />
    </motion.div>
  );
}
