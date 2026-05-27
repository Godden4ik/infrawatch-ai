"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Activity,
  CheckCircle2,
  Loader2,
  Play,
  RadioTower,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { usePipelineStream } from "@/services/pipeline/use-pipeline";
import type { PipelineState } from "@/services/pipeline/schema";
import type { ProviderSelection } from "@/components/provider-selector";
import {
  ProviderCombobox,
  type ProviderListStatus,
} from "@/components/provider-combobox";
import { Button } from "@/components/ui/button";
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

interface PipelineControlsProps {
  state?: PipelineState;
}

function statusCopy(status: PipelineState["status"] | undefined) {
  if (status === "running") {
    return {
      label: "Streaming",
      detail: "Live events updating in real time",
      tone: "border-primary/20 bg-primary/10 text-primary",
      icon: RadioTower,
    };
  }

  if (status === "complete") {
    return {
      label: "Complete",
      detail: "Execution finished cleanly",
      tone: "border-success/20 bg-success/10 text-success",
      icon: CheckCircle2,
    };
  }

  if (status === "error") {
    return {
      label: "Failed",
      detail: "Review runtime trace for failure details",
      tone: "border-destructive/20 bg-destructive/10 text-destructive",
      icon: Activity,
    };
  }

  return {
    label: "Ready",
    detail: "Select healthy provider and launch trace",
    tone: "border-border/70 bg-muted/30 text-muted-foreground",
    icon: Sparkles,
  };
}

export function PipelineControls({ state }: PipelineControlsProps) {
  const [selection, setSelection] = useState<ProviderSelection>({
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  });
  const [providerStatus, setProviderStatus] =
    useState<ProviderListStatus>("loading");

  const mutation = usePipelineStream();
  const status = statusCopy(state?.status);
  const StatusIcon = status.icon;

  const noModelReady = !selection.model || providerStatus !== "ready";
  const runDisabled = mutation.isPending || !selection.provider || noModelReady;

  const runHint =
    providerStatus === "loading"
      ? "loading models..."
      : providerStatus === "empty"
        ? "no healthy provider"
        : providerStatus === "error"
          ? "provider lookup failed"
          : !selection.model
            ? "select a model"
            : null;

  function handleRun() {
    mutation.mutate({
      llmProvider: selection.provider,
      llmModel: selection.model || undefined,
    });
  }

  return (
    <Card size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Runtime Control</CardTitle>
        <CardDescription>
          Select a verified provider connection, choose model, then start streaming.
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            Split-pane
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        <div
          className={cn(
            "flex items-start gap-3 px-3 py-3 ring-1 ring-inset",
            status.tone,
          )}
        >
          <StatusIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em]">
              {status.label}
            </p>
            <p className="mt-1 text-xs leading-5">{status.detail}</p>
          </div>
        </div>

        <ProviderCombobox
          value={selection}
          onChange={setSelection}
          onStatusChange={setProviderStatus}
        />

        <div className="space-y-2 bg-muted/30 px-3 py-3 ring-1 ring-inset ring-border/60">
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Provider
            </span>
            <span className="font-mono text-xs text-foreground">
              {selection.provider}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Model
            </span>
            <span className="max-w-[150px] truncate font-mono text-xs text-foreground">
              {selection.model || "unassigned"}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <Button
            onClick={handleRun}
            disabled={runDisabled}
            size="lg"
            className="w-full justify-center gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Running pipeline
              </>
            ) : (
              <>
                <Play className="h-4 w-4" />
                Launch trace
              </>
            )}
          </Button>
          {runHint && !mutation.isPending ? (
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              {runHint}
            </p>
          ) : null}
        </div>

        <div className="space-y-2 bg-muted/30 px-3 py-3 ring-1 ring-inset ring-border/60">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            <p className="text-xs font-medium text-foreground">Execution path</p>
          </div>
          {[
            "Only healthy providers with valid stored credentials are listed.",
            "Monitor validates anomaly from live telemetry.",
            "Analyst maps service relationships and blast radius.",
            "Responder turns evidence into remediation steps.",
          ].map((item) => (
            <div key={item} className="flex items-start gap-2 text-xs text-muted-foreground">
              <span className="mt-1 h-1.5 w-1.5 shrink-0 bg-muted-foreground/60" />
              <span>{item}</span>
            </div>
          ))}
        </div>

        {mutation.isError ? (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-inset ring-destructive/20"
          >
            {mutation.error.message}
          </motion.p>
        ) : null}
      </CardContent>
    </Card>
  );
}
