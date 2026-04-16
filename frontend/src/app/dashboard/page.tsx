"use client";

import { motion } from "motion/react";
import { ServiceMetrics } from "./_components/service-metrics";
import { LiveMonitor } from "./_components/live-monitor";
import { cn } from "@/lib/utils";

const SERVICES = [
  "api-gateway",
  "payment-service",
  "user-service",
  "order-service",
  "redis-cache",
];

export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <motion.div
        className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">
            Service Health
          </h1>
          <p className="text-sm text-muted-foreground">
            Live Prometheus trends with compact sparkline cards across every
            monitored service
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 font-mono text-[11px] text-muted-foreground">
          <div className="border-border bg-card/50 px-3 py-2 ring-1 ring-inset ring-border/70">
            <div className="tracking-[0.16em] uppercase">Services</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              {SERVICES.length}
            </div>
          </div>
          <div className="border-border bg-card/50 px-3 py-2 ring-1 ring-inset ring-border/70">
            <div className="tracking-[0.16em] uppercase">Window</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              60m
            </div>
          </div>
          <div className="border-border bg-card/50 px-3 py-2 ring-1 ring-inset ring-border/70">
            <div className="tracking-[0.16em] uppercase">Step</div>
            <div className="mt-1 text-sm font-semibold text-foreground">
              1m
            </div>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {SERVICES.map((svc, i) => (
          <motion.div
            key={svc}
            className={cn(
              "h-full",
              svc === "redis-cache" &&
                "md:col-span-2 xl:col-span-3 2xl:col-span-4",
            )}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
          >
            <ServiceMetrics serviceName={svc} />
          </motion.div>
        ))}
      </div>

      <LiveMonitor />
    </div>
  );
}
