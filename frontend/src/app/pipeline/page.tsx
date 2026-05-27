"use client";

import { Fragment, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { motion } from "motion/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Eye,
  Radio,
  RefreshCw,
  Search,
  Wifi,
  WifiOff,
  Wrench,
} from "lucide-react";
import { pipelineKeys } from "@/services/pipeline/query-options";
import {
  deriveTransportStatus,
  type PipelineRunParams,
  type PipelineState,
  type TransportStatus,
} from "@/services/pipeline/schema";
import { usePipelineStream } from "@/services/pipeline/use-pipeline";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusPill, type StatusVariant } from "@/components/ui/status-indicator";
import { PageHeader, PageMetaCell } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";
import { PipelineControls } from "./_components/pipeline-controls";
import { PipelineViewer } from "./_components/pipeline-viewer";

const TRANSPORT_CONFIG: Record<
  TransportStatus,
  { label: string; icon: typeof Wifi; className: string }
> = {
  connecting: {
    label: "Connecting",
    icon: Wifi,
    className: "text-muted-foreground border-border",
  },
  streaming: {
    label: "Streaming",
    icon: Radio,
    className: "border-primary/20 bg-primary/10 text-primary",
  },
  complete: {
    label: "Complete",
    icon: CheckCircle2,
    className: "border-success/20 bg-success/10 text-success",
  },
  error: {
    label: "Disconnected",
    icon: WifiOff,
    className: "border-destructive/20 bg-destructive/10 text-destructive",
  },
};

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

function pipelineStatusVariant(
  status: PipelineState["status"] | undefined,
): StatusVariant {
  if (status === "running") return "degraded";
  if (status === "complete") return "healthy";
  if (status === "error") return "critical";
  return "unknown";
}

function stageStatusVariant(
  state: "complete" | "running" | "standby",
): StatusVariant {
  if (state === "complete") return "healthy";
  if (state === "running") return "degraded";
  return "unknown";
}

function statusTone(status: PipelineState["status"] | undefined) {
  if (status === "running") return "text-status-degraded";
  if (status === "complete") return "text-status-healthy";
  if (status === "error") return "text-status-critical";
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
          <StatusPill
            variant={pipelineStatusVariant(state?.status)}
            pulse={state?.status === "running"}
          >
            {state?.status ?? "idle"}
          </StatusPill>
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
                    {(() => {
                      const stageState: "complete" | "running" | "standby" =
                        complete ? "complete" : running ? "running" : "standby";
                      return (
                        <StatusPill
                          variant={stageStatusVariant(stageState)}
                          pulse={!!running}
                        >
                          {stageState}
                        </StatusPill>
                      );
                    })()}
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

  const retryMutation = usePipelineStream();
  const transport = deriveTransportStatus(state, retryMutation.isPending);
  const transportCfg = TRANSPORT_CONFIG[transport];
  const TransportIcon = transportCfg.icon;

  const summary = getStageSummary(state);

  const showDisconnectBanner =
    state?.status === "error" && !retryMutation.isPending;

  function handleRetry() {
    const params = queryClient.getQueryData<PipelineRunParams>(
      pipelineKeys.lastParams(),
    );
    if (!params) return;
    retryMutation.mutate(params);
  }

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      <PageHeader
        title="Agent Pipeline"
        description="Split-pane runtime for streaming detection, topology analysis, and response planning."
        meta={
          <>
            <PageMetaCell label="Status" value={state?.status ?? "idle"} />
            <PageMetaCell
              label="Agents"
              value={`${summary.completeCount}/${STEP_CONFIG.length}`}
            />
            <PageMetaCell
              label="Transport"
              value={
                <Badge
                  variant="outline"
                  className={cn("font-mono text-[11px]", transportCfg.className)}
                >
                  <TransportIcon className="mr-1 h-3 w-3" />
                  {transportCfg.label}
                </Badge>
              }
            />
          </>
        }
      />

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

      {showDisconnectBanner ? (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 bg-destructive/10 px-4 py-3 ring-1 ring-inset ring-destructive/20 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-destructive">
                Stream disconnected
              </p>
              <p className="mt-1 text-xs text-destructive/90">
                {state?.error ?? "The pipeline stream ended unexpectedly."}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleRetry}
            disabled={
              retryMutation.isPending ||
              !queryClient.getQueryData(pipelineKeys.lastParams())
            }
            className="gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry run
          </Button>
        </motion.div>
      ) : null}

      <div className="grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="xl:sticky xl:top-20 xl:self-start">
          <PipelineControls state={state} />
        </div>
        <PipelineViewer state={state} />
      </div>
    </motion.div>
  );
}
