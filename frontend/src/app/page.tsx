"use client";

import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { healthQueryOptions } from "@/services/health/query-options";
import { StatusIndicator } from "@/components/layout/status-indicator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Activity, Server, Shield, Database, Cpu } from "lucide-react";

const SERVICE_ICONS: Record<string, React.ElementType> = {
  "api-gateway": Shield,
  "payment-service": Cpu,
  "user-service": Server,
  "order-service": Database,
  "redis-cache": Database,
  prometheus: Activity,
  neo4j: Database,
};

export default function HomePage() {
  const { data, isLoading, error } = useQuery(healthQueryOptions);

  const healthyCount = data
    ? Object.values(data.services).filter((s) => s === "healthy").length
    : 0;
  const totalCount = data ? Object.keys(data.services).length : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <motion.div
        className="space-y-1.5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          System Overview
        </h1>
        <p className="text-muted-foreground">
          Real-time infrastructure health across all monitored services
        </p>
      </motion.div>

      {/* Status banner */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.05 }}
      >
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="flex items-center gap-6 py-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Activity className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-semibold">System Status</h2>
                {data && (
                  <div className="flex items-center gap-2">
                    <StatusIndicator
                      status={
                        data.status === "healthy" ? "healthy" : "unhealthy"
                      }
                      size="md"
                    />
                    <span className="text-muted-foreground font-mono text-xs uppercase tracking-wider">
                      {data.status}
                    </span>
                  </div>
                )}
              </div>
              {data && (
                <p className="text-muted-foreground mt-0.5 font-mono text-xs">
                  {healthyCount}/{totalCount} services operational
                </p>
              )}
            </div>
            {data && (
              <div className="text-right font-mono text-xs">
                <span className="text-muted-foreground">Uptime</span>
                <div className="text-emerald-500 text-lg font-semibold tabular-nums">
                  99.9%
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Loading */}
      {isLoading && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 7 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="space-y-3 py-4">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm"
        >
          Failed to fetch service health: {error.message}
        </motion.div>
      )}

      {/* Service cards */}
      {data && (
        <div>
          <h3 className="text-muted-foreground mb-3 text-xs font-medium uppercase tracking-widest">
            Services
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Object.entries(data.services).map(([name, status], i) => {
              const Icon = SERVICE_ICONS[name] ?? Server;
              return (
                <motion.div
                  key={name}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: i * 0.04 }}
                >
                  <Card className="border-border/50 transition-colors hover:border-primary/30">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center justify-between text-sm font-medium">
                        <div className="flex items-center gap-2.5">
                          <Icon className="text-muted-foreground h-4 w-4" />
                          <span className="font-mono text-sm">{name}</span>
                        </div>
                        <StatusIndicator status={status} />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <span
                        className={`font-mono text-xs uppercase tracking-wider ${
                          status === "healthy"
                            ? "text-emerald-500"
                            : status === "unhealthy"
                              ? "text-amber-500"
                              : "text-red-500"
                        }`}
                      >
                        {status}
                      </span>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
