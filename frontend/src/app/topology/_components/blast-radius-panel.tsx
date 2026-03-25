"use client";

import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import {
  blastRadiusQueryOptions,
  runbooksQueryOptions,
} from "@/services/graph/query-options";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, BookOpen, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlastRadiusPanelProps {
  service: string;
  onClose?: () => void;
}

export function BlastRadiusPanel({ service, onClose }: BlastRadiusPanelProps) {
  const blastRadius = useQuery(blastRadiusQueryOptions(service));
  const runbooks = useQuery(runbooksQueryOptions(service));

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="bg-card/80 border-border/50 flex h-full min-h-0 flex-col rounded-xl border backdrop-blur-sm"
    >
      {/* Fixed header */}
      <div className="shrink-0 border-b border-border/30 px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
              Selected Service
            </p>
            <h3 className="mt-1 font-mono text-base font-semibold">
              {service}
            </h3>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground rounded-md p-1 transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Scrollable body */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-6 px-5 py-4">
          {/* Blast Radius */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-red-400" />
              <h4 className="text-sm font-semibold">Blast Radius</h4>
            </div>
            {blastRadius.isLoading && (
              <Skeleton className="h-16 rounded-lg" />
            )}
            {blastRadius.data && (
              <>
                {blastRadius.data.affected_services.length === 0 ? (
                  <p className="text-muted-foreground text-sm">
                    No downstream impact
                  </p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-muted-foreground text-xs">
                      {blastRadius.data.affected_services.length} service
                      {blastRadius.data.affected_services.length > 1
                        ? "s"
                        : ""}{" "}
                      affected
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {blastRadius.data.affected_services.map((s, i) => (
                        <motion.div
                          key={s}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.05 }}
                        >
                          <Badge className="border-0 bg-red-500/10 font-mono text-xs text-red-400">
                            {s}
                          </Badge>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Runbooks */}
          <div>
            <div className="mb-3 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-blue-400" />
              <h4 className="text-sm font-semibold">Runbooks</h4>
            </div>
            {runbooks.isLoading && (
              <Skeleton className="h-24 rounded-lg" />
            )}
            {runbooks.data && runbooks.data.length === 0 && (
              <p className="text-muted-foreground text-sm">
                No runbooks available
              </p>
            )}
            {runbooks.data?.map((rb, i) => (
              <motion.div
                key={rb.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.08 }}
                className="mb-3 rounded-lg bg-secondary/30 p-3.5"
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <span className="text-sm font-medium leading-snug">
                    {rb.title}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "shrink-0 font-mono text-[10px] uppercase",
                      rb.severity === "critical" &&
                        "bg-red-500/15 text-red-400",
                      rb.severity === "high" &&
                        "bg-amber-500/15 text-amber-400",
                      rb.severity === "medium" &&
                        "bg-blue-500/15 text-blue-400",
                    )}
                  >
                    {rb.severity}
                  </Badge>
                </div>
                {rb.steps.length > 0 && (
                  <ol className="space-y-1 pl-4 text-xs leading-relaxed text-muted-foreground">
                    {rb.steps.map((step, j) => (
                      <li key={j} className="list-decimal">
                        {step}
                      </li>
                    ))}
                  </ol>
                )}
              </motion.div>
            ))}
          </div>
        </div>
      </ScrollArea>
    </motion.div>
  );
}
