"use client";

import { motion } from "motion/react";
import { ServiceMetrics } from "./_components/service-metrics";

const SERVICES = [
  "api-gateway",
  "payment-service",
  "user-service",
  "order-service",
  "redis-cache",
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <motion.div
        className="space-y-1.5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          Service Health
        </h1>
        <p className="text-muted-foreground">
          Live Prometheus metrics across all monitored services
        </p>
      </motion.div>

      {SERVICES.map((svc, i) => (
        <motion.div
          key={svc}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.08 }}
        >
          <ServiceMetrics serviceName={svc} />
        </motion.div>
      ))}
    </div>
  );
}
