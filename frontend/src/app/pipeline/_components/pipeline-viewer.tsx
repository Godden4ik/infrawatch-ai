"use client";

import { useQueryClient } from "@tanstack/react-query";
import { pipelineKeys } from "@/services/pipeline/query-options";
import { AGENT_ORDER } from "@/services/pipeline/schema";
import type { PipelineState } from "@/services/pipeline/schema";
import { AgentOutput } from "./agent-output";
import { useSyncExternalStore } from "react";
import { motion } from "motion/react";
import { Bot } from "lucide-react";

export function PipelineViewer() {
  const queryClient = useQueryClient();
  const state = useSyncExternalStore(
    (cb) => {
      const unsub = queryClient.getQueryCache().subscribe(cb);
      return unsub;
    },
    () =>
      queryClient.getQueryData<PipelineState>(pipelineKeys.currentRun()),
    () => undefined,
  );

  if (!state) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="bg-secondary/50 mb-4 flex h-14 w-14 items-center justify-center rounded-2xl">
          <Bot className="text-muted-foreground/40 h-7 w-7" />
        </div>
        <p className="text-muted-foreground text-base">
          Run the pipeline to trace agent reasoning
        </p>
        <p className="text-muted-foreground/50 mt-1 text-sm">
          Monitor → Analyst → Responder
        </p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {state.error && (
        <div className="bg-destructive/10 text-destructive mb-6 rounded-lg px-4 py-3 text-sm">
          {state.error}
        </div>
      )}

      <div>
        {AGENT_ORDER.map((agent, i) => (
          <AgentOutput
            key={agent}
            agentName={agent}
            stepNumber={i + 1}
            isLast={i === AGENT_ORDER.length - 1}
            data={state.agents[agent]}
          />
        ))}
      </div>
    </motion.div>
  );
}
