"use client";

import { motion } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { injectScenario, resetAnomalies } from "@/services/anomaly/actions";
import { Button } from "@/components/ui/button";
import { Flame, RotateCcw, Loader2, CheckCircle2 } from "lucide-react";

export function ScenarioButtons() {
  const cascadeMutation = useMutation({
    mutationFn: () => injectScenario("cascade"),
  });

  const resetMutation = useMutation({
    mutationFn: () => resetAnomalies(),
  });

  return (
    <div className="space-y-4">
      <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
        Preset Scenarios
      </h3>
      <div className="space-y-3">
        <Button
          onClick={() => cascadeMutation.mutate()}
          disabled={cascadeMutation.isPending}
          variant="destructive"
          className="h-14 w-full gap-3 rounded-xl text-base font-medium"
          size="lg"
        >
          {cascadeMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Flame className="h-5 w-5" />
          )}
          Cascade Failure
        </Button>
        <Button
          onClick={() => resetMutation.mutate()}
          disabled={resetMutation.isPending}
          variant="outline"
          className="h-14 w-full gap-3 rounded-xl text-base font-medium"
          size="lg"
        >
          {resetMutation.isPending ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <RotateCcw className="h-5 w-5" />
          )}
          Reset All Services
        </Button>
      </div>

      {(cascadeMutation.isSuccess || resetMutation.isSuccess) && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-emerald-500"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">
            {cascadeMutation.isSuccess ? "Cascade injected" : "All anomalies reset"}
          </span>
        </motion.div>
      )}
    </div>
  );
}
