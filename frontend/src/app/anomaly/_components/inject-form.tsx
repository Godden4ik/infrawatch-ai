"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { injectAnomaly } from "@/services/anomaly/actions";
import { SERVICES, ANOMALY_TYPES } from "@/services/anomaly/schema";
import { healthKeys } from "@/services/health/query-options";
import { Button } from "@/components/ui/button";
import { Syringe, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function InjectForm() {
  const [service, setService] = useState<string>(SERVICES[0]);
  const [anomalyType, setAnomalyType] = useState<string>(ANOMALY_TYPES[0]);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => injectAnomaly(service, anomalyType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: healthKeys.all });
    },
  });

  return (
    <div className="space-y-6">
      <h3 className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
        Manual Injection
      </h3>

      {/* Service selector */}
      <div>
        <label className="mb-3 block text-sm font-medium">Target Service</label>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
          {SERVICES.map((s) => (
            <button
              key={s}
              onClick={() => setService(s)}
              className={cn(
                "relative rounded-lg px-4 py-3 text-left font-mono text-sm transition-all",
                service === s
                  ? "bg-primary/10 text-primary ring-primary/30 ring-1"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {service === s && (
                <motion.div
                  layoutId="service-select"
                  className="bg-primary/10 ring-primary/30 absolute inset-0 rounded-lg ring-1"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{s}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Anomaly type selector */}
      <div>
        <label className="mb-3 block text-sm font-medium">Anomaly Type</label>
        <div className="flex flex-wrap gap-2">
          {ANOMALY_TYPES.map((t) => (
            <button
              key={t}
              onClick={() => setAnomalyType(t)}
              className={cn(
                "relative rounded-lg px-4 py-2.5 text-sm transition-all",
                anomalyType === t
                  ? "bg-destructive/10 text-destructive ring-destructive/30 ring-1"
                  : "bg-secondary/40 text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              {anomalyType === t && (
                <motion.div
                  layoutId="anomaly-select"
                  className="bg-destructive/10 ring-destructive/30 absolute inset-0 rounded-lg ring-1"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                />
              )}
              <span className="relative">{t.replace(/_/g, " ")}</span>
            </button>
          ))}
        </div>
      </div>

      <Button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="h-12 w-full gap-2.5 rounded-xl text-base font-medium"
        size="lg"
      >
        {mutation.isPending ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Syringe className="h-5 w-5" />
        )}
        Inject Anomaly
      </Button>

      {mutation.isSuccess && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-emerald-500"
        >
          <CheckCircle2 className="h-4 w-4" />
          <span className="text-sm">Anomaly injected into {service}</span>
        </motion.div>
      )}

      {mutation.isError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm"
        >
          {mutation.error.message}
        </motion.div>
      )}
    </div>
  );
}
