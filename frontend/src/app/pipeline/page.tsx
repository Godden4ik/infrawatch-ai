"use client";

import { Fragment } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { pipelineKeys } from "@/services/pipeline/query-options";
import { AGENT_ORDER } from "@/services/pipeline/schema";
import type { PipelineState } from "@/services/pipeline/schema";
import { PipelineControls } from "./_components/pipeline-controls";
import { PipelineViewer } from "./_components/pipeline-viewer";
import { Eye, Search, Wrench, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEP_CONFIG = [
  { key: "monitor_node", label: "Monitor", icon: Eye, color: "#3b82f6" },
  { key: "analyst_node", label: "Analyst", icon: Search, color: "#a855f7" },
  { key: "responder_node", label: "Responder", icon: Wrench, color: "#22c55e" },
] as const;

function ProgressBar() {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(
    (cb) => queryClient.getQueryCache().subscribe(cb),
    () => queryClient.getQueryData<PipelineState>(pipelineKeys.currentRun()),
    () => undefined,
  );

  if (!state) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-secondary/40 flex items-center rounded-xl p-2"
    >
      {STEP_CONFIG.map((step, i) => {
        const agentData = state.agents[step.key];
        const isComplete = !!agentData?.result;
        const isRunning =
          agentData && (agentData.tokens || agentData.toolCalls.length > 0) && !isComplete;
        const Icon = step.icon;

        return (
          <Fragment key={step.key}>
            {/* Step */}
            <div className="flex shrink-0 items-center gap-2.5 px-3 py-1.5">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-all",
                  isComplete && "text-white",
                  !isComplete && !isRunning && "bg-secondary text-muted-foreground",
                )}
                style={{
                  background: isComplete ? step.color : isRunning ? `${step.color}20` : undefined,
                  ...(isRunning ? { boxShadow: `0 0 0 2px ${step.color}` } : {}),
                }}
              >
                {isComplete ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Icon className="h-3.5 w-3.5" style={isRunning ? { color: step.color } : {}} />
                )}
              </div>
              <span
                className={cn(
                  "text-sm font-medium",
                  isRunning || isComplete ? "text-foreground" : "text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {isRunning && (
                <motion.span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: step.color }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                />
              )}
            </div>

            {/* Connector */}
            {i < STEP_CONFIG.length - 1 && (
              <div className="bg-border relative mx-2 h-px flex-1 overflow-hidden">
                {isComplete && (
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: step.color, transformOrigin: "left" }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.4 }}
                  />
                )}
              </div>
            )}
          </Fragment>
        );
      })}
    </motion.div>
  );
}

export default function PipelinePage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">
          Agent Pipeline
        </h1>
        <p className="text-muted-foreground">
          Monitor → Analyst → Responder with live SSE streaming
        </p>
      </div>

      <ProgressBar />

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <PipelineControls />
        <PipelineViewer />
      </div>
    </div>
  );
}
