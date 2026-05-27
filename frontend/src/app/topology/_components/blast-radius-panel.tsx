"use client";

import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import {
  blastRadiusQueryOptions,
  runbooksQueryOptions,
} from "@/services/graph/query-options";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Zap, BookOpen, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface QueryErrorProps {
  message: string;
  onRetry: () => void;
}

function QueryError({ message, onRetry }: QueryErrorProps) {
  return (
    <div className="flex flex-col gap-2 border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
      <div className="flex items-center gap-2 font-mono uppercase tracking-[0.16em]">
        <AlertTriangle className="h-3.5 w-3.5" />
        <span>Request failed</span>
      </div>
      <p className="leading-relaxed">{message}</p>
      <Button
        variant="destructive"
        size="xs"
        onClick={onRetry}
        className="self-start"
      >
        <RefreshCw />
        Retry
      </Button>
    </div>
  );
}

interface BlastRadiusPanelProps {
  service: string;
}

export function BlastRadiusPanel({ service }: BlastRadiusPanelProps) {
  const blastRadius = useQuery(blastRadiusQueryOptions(service));
  const runbooks = useQuery(runbooksQueryOptions(service));

  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      className="space-y-6 p-4"
    >
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-destructive" />
          <h4 className="text-sm font-semibold">Blast Radius</h4>
        </div>

        {blastRadius.isPending ? <Skeleton className="h-16" /> : null}

        {blastRadius.isError ? (
          <QueryError
            message={blastRadius.error.message}
            onRetry={() => blastRadius.refetch()}
          />
        ) : null}

        {blastRadius.data ? (
          blastRadius.data.affected_services.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No downstream impact.
            </p>
          ) : (
            <div className="space-y-2">
              <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground">
                {blastRadius.data.affected_services.length} affected services
              </p>
              <div className="flex flex-wrap gap-1.5">
                {blastRadius.data.affected_services.map((item, index) => (
                  <motion.div
                    key={item}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Badge
                      variant="destructive"
                      className="font-mono text-[10px] uppercase"
                    >
                      {item}
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </div>
          )
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Runbooks</h4>
        </div>

        {runbooks.isPending ? <Skeleton className="h-24" /> : null}

        {runbooks.isError ? (
          <QueryError
            message={runbooks.error.message}
            onRetry={() => runbooks.refetch()}
          />
        ) : null}

        {runbooks.data && runbooks.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No runbooks available.</p>
        ) : null}

        {runbooks.data?.map((runbook, index) => (
          <motion.div
            key={runbook.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.08 }}
            className="border border-border/70 bg-muted/30 p-3"
          >
            <div className="mb-2 flex items-start justify-between gap-2">
              <span className="text-sm font-medium leading-snug">
                {runbook.title}
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "font-mono text-[10px] uppercase",
                  runbook.severity === "critical" &&
                    "border-destructive/40 text-destructive",
                  runbook.severity === "high" &&
                    "border-chart-2/50 text-chart-2",
                  runbook.severity === "medium" &&
                    "border-primary/40 text-primary",
                )}
              >
                {runbook.severity}
              </Badge>
            </div>

            {runbook.steps.length > 0 ? (
              <ol className="space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                {runbook.steps.map((step, stepIndex) => (
                  <li key={stepIndex} className="list-decimal">
                    {step}
                  </li>
                ))}
              </ol>
            ) : null}
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}
