"use client";

import { motion } from "motion/react";
import { useMetricsStream } from "@/hooks/use-metrics-stream";
import { ServiceMetrics } from "./_components/service-metrics";
import { LiveMonitor } from "./_components/live-monitor";
import { PageHeader, PageMetaCell } from "@/components/layout/page-header";
import { cn } from "@/lib/utils";

const SERVICES = [
  "api-gateway",
  "payment-service",
  "user-service",
  "order-service",
  "redis-cache",
];

export default function DashboardPage() {
  const { services } = useMetricsStream();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Service Health"
        description="Live Prometheus metrics streaming across every monitored service"
        meta={
          <>
            <PageMetaCell label="Services" value={SERVICES.length} />
            <PageMetaCell label="Window" value="5m" />
            <PageMetaCell label="Refresh" value="2s" />
          </>
        }
      />

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {SERVICES.map((svc, i) => (
          <motion.div
            key={svc}
            className={cn(
              "h-full",
              svc === "redis-cache" &&
                "md:col-span-2 xl:col-span-3 2xl:col-span-4",
            )}
            style={{ viewTransitionName: `node-${svc}` }}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06 }}
          >
            <ServiceMetrics serviceName={svc} streamData={services[svc]} />
          </motion.div>
        ))}
      </div>

      <LiveMonitor />
    </div>
  );
}
