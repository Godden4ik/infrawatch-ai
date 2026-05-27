"use client";

import { useQuery } from "@tanstack/react-query";
import { Activity, ShieldAlert } from "lucide-react";
import { anomalyStatusQueryOptions } from "@/services/anomaly/query-options";
import { SERVICES } from "@/services/anomaly/schema";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StatusPill, type StatusVariant } from "@/components/ui/status-indicator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const CRITICAL_TYPES = new Set(["cache_failure", "memory_leak"]);

function severityVariant(type: string): StatusVariant {
  return CRITICAL_TYPES.has(type) ? "critical" : "degraded";
}

function formatAnomalyLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatSince(raw: string | null) {
  if (!raw) return null;
  const ts = new Date(raw);
  if (Number.isNaN(ts.getTime())) return raw;
  return ts.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function LiveStatusPanel() {
  const { data, isLoading, isError } = useQuery(anomalyStatusQueryOptions);

  const byService = new Map(
    (data?.services ?? []).map((entry) => [entry.service, entry]),
  );
  const activeCount = (data?.services ?? []).filter(
    (entry) => entry.anomaly_type,
  ).length;

  return (
    <Card size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          Live Status
        </CardTitle>
        <CardDescription>
          Server-reported fault state per service. Polls every 5s.
        </CardDescription>
        <CardAction>
          <Badge
            variant={activeCount > 0 ? "destructive" : "outline"}
            className="font-mono text-[10px] uppercase"
          >
            {isLoading ? "…" : `${activeCount} active`}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-3">
        {isError ? (
          <div className="bg-destructive/10 px-3 py-3 text-xs text-destructive ring-1 ring-inset ring-destructive/20">
            Failed to load anomaly status from backend.
          </div>
        ) : isLoading && !data ? (
          <div className="space-y-2">
            {SERVICES.map((service) => (
              <Skeleton key={service} className="h-7 w-full" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Service
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  State
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Since
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SERVICES.map((service) => {
                const entry = byService.get(service);
                const anomalyType = entry?.anomaly_type ?? null;
                const since = formatSince(entry?.since ?? null);
                return (
                  <TableRow key={service}>
                    <TableCell className="font-mono text-[11px]">
                      <span className="flex items-center gap-2">
                        {anomalyType ? (
                          <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-status-healthy" />
                        )}
                        {service}
                      </span>
                    </TableCell>
                    <TableCell>
                      {anomalyType ? (
                        <StatusPill variant={severityVariant(anomalyType)}>
                          {formatAnomalyLabel(anomalyType)}
                        </StatusPill>
                      ) : (
                        <StatusPill variant="healthy">healthy</StatusPill>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-muted-foreground">
                      {since ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
