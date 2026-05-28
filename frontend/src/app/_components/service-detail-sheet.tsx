"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Activity, Network, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatusBar,
  StatusPill,
  type StatusVariant,
} from "@/components/ui/status-indicator";
import { anomalyStatusQueryOptions } from "@/services/anomaly/query-options";
import {
  incidentsQueryOptions,
  runbooksQueryOptions,
} from "@/services/graph/query-options";

export interface ServiceDetailSheetService {
  id: string;
  name: string;
  type?: string;
  healthVariant: StatusVariant;
  healthLabel: string;
  lastHealthCheck?: string;
}

export interface ServiceDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  service: ServiceDetailSheetService | null;
}

function formatRelative(iso: string | null | undefined) {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const diff = Date.now() - t;
  if (diff < 0) return new Date(iso).toLocaleTimeString();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return new Date(iso).toLocaleDateString();
}

export function ServiceDetailSheet({
  open,
  onOpenChange,
  service,
}: ServiceDetailSheetProps) {
  const enabled = open && !!service;
  const serviceId = service?.id ?? "";

  const { data: anomalyData } = useQuery({
    ...anomalyStatusQueryOptions,
    enabled,
  });
  const { data: runbookData, isLoading: runbooksLoading } = useQuery({
    ...runbooksQueryOptions(serviceId),
    enabled: enabled && serviceId.length > 0,
  });
  const { data: incidentData, isLoading: incidentsLoading } = useQuery({
    ...incidentsQueryOptions(serviceId),
    enabled: enabled && serviceId.length > 0,
  });

  if (!service) return null;

  const anomalyEntry = anomalyData?.services.find((s) => s.service === service.id);
  const anomalyActive = anomalyEntry?.anomaly_type ?? null;
  const anomalySince = anomalyEntry?.since ?? null;
  const runbookCount = runbookData?.length ?? null;
  const incidentCount = incidentData?.length ?? null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-[400px] border-l border-border bg-background p-0 sm:max-w-[400px]"
      >
        <SheetHeader className="border-b border-border/60 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
                {service.type ?? "Service"}
              </p>
              <SheetTitle className="font-mono text-base font-semibold">
                {service.name}
              </SheetTitle>
            </div>
            <StatusPill variant={service.healthVariant}>
              {service.healthLabel}
            </StatusPill>
          </div>
          <SheetDescription className="text-xs text-muted-foreground">
            Live health, fault state, runbooks, and quick actions.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-5 py-4">
          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
              Live Health
            </p>
            <div className="relative flex items-center gap-3 bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border/60">
              <StatusBar variant={service.healthVariant} />
              <span className="font-mono text-sm capitalize">
                {service.healthLabel}
              </span>
            </div>
            {service.lastHealthCheck && (
              <p className="font-mono text-[10px] text-muted-foreground">
                Last health check —{" "}
                <span className="text-foreground/70">
                  {service.lastHealthCheck}
                </span>
              </p>
            )}
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
              Fault State
            </p>
            {anomalyData ? (
              anomalyActive ? (
                <div className="relative flex items-start gap-3 bg-status-critical-soft px-3 py-2 ring-1 ring-inset ring-status-critical/30">
                  <StatusBar variant="critical" />
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm uppercase text-status-critical">
                      {anomalyActive.replace(/_/g, " ")}
                    </p>
                    {anomalySince && (
                      <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                        since {formatRelative(anomalySince)}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <p className="font-mono text-xs text-muted-foreground">
                  No active fault. Service is in nominal state.
                </p>
              )
            ) : (
              <Skeleton className="h-9 w-full" />
            )}
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
              Knowledge Base
            </p>
            <ul className="space-y-1.5 font-mono text-xs text-muted-foreground">
              <li className="flex items-baseline justify-between gap-3">
                <span>· Linked runbooks</span>
                {runbooksLoading ? (
                  <Skeleton className="h-3 w-8" />
                ) : (
                  <span className="text-foreground/80 tabular-nums">
                    {runbookCount ?? 0}
                  </span>
                )}
              </li>
              <li className="flex items-baseline justify-between gap-3">
                <span>· Historical incidents</span>
                {incidentsLoading ? (
                  <Skeleton className="h-3 w-8" />
                ) : (
                  <span className="text-foreground/80 tabular-nums">
                    {incidentCount ?? 0}
                  </span>
                )}
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
              Quick Actions
            </p>
            <div className="grid gap-2">
              <Button
                nativeButton={false}
                render={
                  <Link href="/topology">
                    <Network className="h-3.5 w-3.5" />
                    View on Topology
                  </Link>
                }
              />
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link href="/dashboard">
                    <Activity className="h-3.5 w-3.5" />
                    View Metrics
                  </Link>
                }
              />
              <Button
                nativeButton={false}
                variant="outline"
                render={
                  <Link href="/anomaly">
                    <Zap className="h-3.5 w-3.5" />
                    Inject Anomaly
                  </Link>
                }
              />
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
