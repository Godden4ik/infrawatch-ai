"use client";

import { motion } from "motion/react";
import { Radio, Wifi, WifiOff } from "lucide-react";
import { useMetricsStream } from "@/hooks/use-metrics-stream";
import { METRIC_GROUPS } from "@/lib/metric-registry";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LiveChart } from "./live-chart";

const STATUS_CONFIG = {
  connecting: { label: "Connecting", icon: Wifi, className: "text-muted-foreground border-border" },
  live: { label: "Live", icon: Radio, className: "border-primary/20 bg-primary/10 text-primary" },
  error: { label: "Disconnected", icon: WifiOff, className: "border-destructive/20 bg-destructive/10 text-destructive" },
} as const;

export function LiveMonitor() {
  const { services, status } = useMetricsStream();
  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.icon;

  const totalMetrics = METRIC_GROUPS.reduce((sum, g) => sum + g.metrics.length, 0);

  return (
    <motion.section
      className="space-y-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Live Monitor</h2>
          <p className="text-sm text-muted-foreground">
            Real-time Prometheus metrics · 2s refresh · 5m window
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="font-mono text-[11px] text-muted-foreground">
            {totalMetrics} metrics
          </div>
          <Badge
            variant="outline"
            className={cn("font-mono text-[11px]", statusCfg.className)}
          >
            <StatusIcon className="mr-1 h-3 w-3" />
            {statusCfg.label}
          </Badge>
        </div>
      </div>

      {METRIC_GROUPS.map((group, groupIdx) => {
        const serviceData = services[group.service] ?? {};
        return (
          <motion.div
            key={group.service}
            className="space-y-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 + groupIdx * 0.06 }}
          >
            <h3 className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase sticky -top-5 z-10 bg-background/95 backdrop-blur-sm py-2 -mx-6 px-6 border-b border-border/40">
              {group.label}
            </h3>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {group.metrics.map((metric) => (
                <LiveChart
                  key={`${group.service}-${metric.key}`}
                  label={metric.label}
                  metricKey={metric.key}
                  points={serviceData[metric.key] ?? []}
                  colorVar={group.colorVar}
                  format={metric.format}
                />
              ))}
            </div>
          </motion.div>
        );
      })}
    </motion.section>
  );
}
