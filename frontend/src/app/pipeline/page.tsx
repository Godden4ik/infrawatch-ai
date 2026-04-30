"use client";

import { Fragment, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  Check,
  Eye,
  Search,
  Wrench,
} from "lucide-react";
import { pipelineKeys } from "@/services/pipeline/query-options";
import type { PipelineState } from "@/services/pipeline/schema";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { PipelineControls } from "./_components/pipeline-controls";
import { PipelineViewer } from "./_components/pipeline-viewer";

const STEP_CONFIG = [
  {
    key: "monitor_node",
    label: "Monitor",
    detail: "Metrics + anomaly scan",
    icon: Eye,
    accent: "text-primary",
    marker: "bg-primary",
  },
  {
    key: "analyst_node",
    label: "Analyst",
    detail: "Topology + blast radius",
    icon: Search,
    accent: "text-warning",
    marker: "bg-warning",
  },
  {
    key: "responder_node",
    label: "Responder",
    detail: "Runbook-backed action plan",
    icon: Wrench,
    accent: "text-success",
    marker: "bg-success",
  },
] as const;

function getStageSummary(state: PipelineState | undefined) {
  if (!state) {
    return {
      label: "Awaiting run",
      detail: "No live execution yet",
      completeCount: 0,
      activeKey: null as string | null,
    };
  }

  const completeCount = STEP_CONFIG.filter(
    (step) => !!state.agents[step.key]?.result,
  ).length;
  const activeStep = STEP_CONFIG.find((step) => {
    const agent = state.agents[step.key];
    return agent && (agent.tokens || agent.toolCalls.length > 0) && !agent.result;
  });

  if (state.status === "error") {
    return {
      label: "Execution failed",
      detail: "Review runtime trace for failure details",
      completeCount,
      activeKey: activeStep?.key ?? null,
    };
  }

  if (state.status === "complete") {
    return {
      label: "Run complete",
      detail: `${completeCount}/${STEP_CONFIG.length} agents finished`,
      completeCount,
      activeKey: null,
    };
  }

  if (activeStep) {
    return {
      label: `${activeStep.label} active`,
      detail: activeStep.detail,
      completeCount,
      activeKey: activeStep.key,
    };
  }

  return {
    label: "Pipeline armed",
    detail: "Ready to stream first agent output",
    completeCount,
    activeKey: null,
  };
}

function statusBadgeVariant(status: PipelineState["status"] | undefined) {
  if (status === "running") return "default";
  if (status === "complete") return "outline";
  if (status === "error") return "destructive";
  return "outline";
}

function statusTone(status: PipelineState["status"] | undefined) {
  if (status === "running") return "text-primary";
  if (status === "complete") return "text-success";
  if (status === "error") return "text-destructive";
  return "text-muted-foreground";
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: string;
  sublabel: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1.5 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="font-mono text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {sublabel}
        </p>
      </CardContent>
    </Card>
  );
}

function ProgressRail({ state }: { state: PipelineState | undefined }) {
  const summary = getStageSummary(state);

  return (
    <Card size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Runtime Flow</CardTitle>
        <CardDescription>
          Monitor verifies signal. Analyst narrows topology. Responder drafts action.
        </CardDescription>
        <CardAction>
          <Badge
            variant={statusBadgeVariant(state?.status)}
            className={cn(
              "font-mono text-[10px] uppercase tracking-[0.14em]",
              state?.status === "running" && "bg-primary/10 text-primary",
              state?.status === "complete" && "text-success",
            )}
          >
            {state?.status ?? "idle"}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        <div className="flex items-center justify-between gap-3 bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border/60">
          <div>
            <p className="text-sm font-medium text-foreground">{summary.label}</p>
            <p className="text-xs text-muted-foreground">{summary.detail}</p>
          </div>
          <span className={cn("font-mono text-[11px] uppercase", statusTone(state?.status))}>
            {summary.completeCount}/{STEP_CONFIG.length}
          </span>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto_1fr]">
          {STEP_CONFIG.map((step, index) => {
            const agent = state?.agents[step.key];
            const complete = !!agent?.result;
            const running =
              !!agent && (agent.tokens || agent.toolCalls.length > 0) && !complete;
            const Icon = step.icon;

            return (
              <Fragment key={step.key}>
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06, duration: 0.25 }}
                  className={cn(
                    "space-y-3 bg-muted/20 px-3 py-3 ring-1 ring-inset ring-border/60",
                    complete && "bg-success/10 ring-success/20",
                    running && "bg-card ring-foreground/15",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                        Step {index + 1}
                      </p>
                      <p className="text-sm font-medium text-foreground">{step.label}</p>
                      <p className="text-xs text-muted-foreground">{step.detail}</p>
                    </div>
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center border border-border/70 bg-background/60",
                        complete && "border-success/20 bg-success/10 text-success",
                        running && `${step.accent} border-border bg-card`,
                      )}
                    >
                      {complete ? <Check className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span
                      className={cn(
                        "font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground",
                        complete && "text-success",
                        running && step.accent,
                      )}
                    >
                      {complete ? "complete" : running ? "running" : "standby"}
                    </span>
                    {running ? (
                      <motion.span
                        className={cn("h-1.5 w-1.5", step.marker)}
                        animate={{ opacity: [1, 0.25, 1] }}
                        transition={{ duration: 1.2, repeat: Infinity }}
                      />
                    ) : null}
                  </div>
                </motion.div>

                {index < STEP_CONFIG.length - 1 ? (
                  <div className="hidden items-center justify-center lg:flex">
                    <div className="relative h-px w-8 bg-border/80">
                      {(complete || summary.activeKey === step.key) && (
                        <motion.div
                          className={cn("absolute inset-0", step.marker)}
                          initial={{ scaleX: 0, originX: 0 }}
                          animate={{ scaleX: 1 }}
                          transition={{ duration: 0.35 }}
                        />
                      )}
                    </div>
                  </div>
                ) : null}
              </Fragment>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export default function PipelinePage() {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(
    (callback) => queryClient.getQueryCache().subscribe(callback),
    () => queryClient.getQueryData<PipelineState>(pipelineKeys.currentRun()),
    () => undefined,
  );

  const summary = getStageSummary(state);

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-base font-semibold">Agent Pipeline</h1>
          <p className="text-xs text-muted-foreground">
            Split-pane runtime for streaming detection, topology analysis, and response planning.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-muted-foreground">
          <div className="bg-card/50 px-3 py-2 ring-1 ring-inset ring-border/70">
            <div className="tracking-[0.16em] uppercase">Status</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {state?.status ?? "idle"}
            </div>
          </div>
          <div className="bg-card/50 px-3 py-2 ring-1 ring-inset ring-border/70">
            <div className="tracking-[0.16em] uppercase">Agents</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {summary.completeCount}/{STEP_CONFIG.length}
            </div>
          </div>
          <div className="bg-card/50 px-3 py-2 ring-1 ring-inset ring-border/70">
            <div className="tracking-[0.16em] uppercase">Transport</div>
            <div className="mt-1 text-sm font-semibold text-foreground">SSE</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Run state"
          value={state?.status ?? "idle"}
          sublabel={summary.label}
        />
        <StatCard
          label="Completed"
          value={`${summary.completeCount}/${STEP_CONFIG.length}`}
          sublabel="agent stages finished"
        />
        <StatCard
          label="Current lane"
          value={summary.activeKey ? summary.label.split(" ")[0] : "none"}
          sublabel="currently emitting output"
        />
        <StatCard
          label="Flow"
          value="3"
          sublabel="monitor analyst responder"
        />
      </div>

      <ProgressRail state={state} />

      <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-20 xl:self-start">
          <PipelineControls state={state} />
        </div>
        <PipelineViewer state={state} />
      </div>
    </motion.div>
  );
}
