"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, History, ShieldAlert, Target } from "lucide-react";
import { healthQueryOptions } from "@/services/health/query-options";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PageHeader, PageMetaCell } from "@/components/layout/page-header";
import { PageMount } from "@/components/layout/page-mount";
import { cn } from "@/lib/utils";
import { ScenarioButtons } from "./_components/scenario-buttons";
import { InjectForm } from "./_components/inject-form";
import { LiveStatusPanel } from "./_components/live-status-panel";
import type { ActiveInjection, InjectionEvent } from "./_components/types";

function buildEventId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function statusDot(status: "healthy" | "unhealthy" | "unreachable" | undefined) {
  if (status === "healthy") return "bg-status-healthy";
  if (status === "unhealthy") return "bg-status-degraded";
  return "bg-muted-foreground";
}

function formatAnomalyLabel(value: string) {
  return value.replace(/_/g, " ");
}

function formatEventTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StatCard({
  label,
  value,
  sublabel,
}: {
  label: string;
  value: React.ReactNode;
  sublabel: string;
}) {
  return (
    <Card size="sm">
      <CardContent className="space-y-1.5 pt-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
          {sublabel}
        </p>
      </CardContent>
    </Card>
  );
}

function ActiveAnomaliesCard({
  activeInjections,
}: {
  activeInjections: ActiveInjection[];
}) {
  return (
    <Card size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Active Faults</CardTitle>
        <CardDescription>
          Current locally tracked injections pending reset or overwrite.
        </CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {activeInjections.length}
          </Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="pt-3">
        {activeInjections.length === 0 ? (
          <div className="bg-muted/30 px-3 py-3 text-xs text-muted-foreground ring-1 ring-inset ring-border/60">
            No active anomalies tracked.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Service
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Fault
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Source
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activeInjections.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-mono text-[11px]">
                    <span className="flex items-center gap-2">
                      <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
                      {entry.service}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase">
                    {formatAnomalyLabel(entry.anomalyType)}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase text-muted-foreground">
                    {entry.source}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="destructive"
                      className="font-mono text-[10px] uppercase"
                    >
                      {entry.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function ServiceTargetsCard({
  activeInjections,
  serviceStatuses,
}: {
  activeInjections: ActiveInjection[];
  serviceStatuses?: Record<string, "healthy" | "unhealthy" | "unreachable">;
}) {
  return (
    <Card size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Targets</CardTitle>
        <CardDescription>
          Service health overlay with current injected fault marker.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-3">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Service
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Health
              </TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                Fault
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SERVICES.map((service) => {
              const active = activeInjections.find((entry) => entry.service === service);
              const status = serviceStatuses?.[service];

              return (
                <TableRow key={service}>
                  <TableCell className="font-mono text-[11px]">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          statusDot(status),
                        )}
                      />
                      <span className="truncate">{service}</span>
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase text-muted-foreground">
                    {status ?? "unknown"}
                  </TableCell>
                  <TableCell>
                    {active ? (
                      <Badge
                        variant="destructive"
                        className="max-w-32 truncate font-mono text-[10px] uppercase"
                      >
                        {formatAnomalyLabel(active.anomalyType)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="font-mono text-[10px] uppercase">
                        clear
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function HistoryCard({ events }: { events: InjectionEvent[] }) {
  return (
    <Card size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Recent Events</CardTitle>
        <CardDescription>Local operator journal for this browser session.</CardDescription>
        <CardAction>
          <Badge variant="outline" className="font-mono text-[10px] uppercase">
            {events.length}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="pt-3">
        {events.length === 0 ? (
          <div className="bg-muted/30 px-3 py-3 text-xs text-muted-foreground ring-1 ring-inset ring-border/60">
            No anomaly actions recorded yet.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Time
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Action
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Target
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Source
                </TableHead>
                <TableHead className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                  Status
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.slice(0, 8).map((event) => (
                <TableRow key={event.id}>
                  <TableCell className="font-mono text-[11px] text-muted-foreground">
                    {formatEventTime(event.timestamp)}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase">
                    {event.kind === "reset" ? "reset" : formatAnomalyLabel(event.anomalyType)}
                  </TableCell>
                  <TableCell className="font-mono text-[11px]">
                    {event.kind === "reset" ? "all services" : event.service}
                  </TableCell>
                  <TableCell className="font-mono text-[11px] uppercase text-muted-foreground">
                    {event.kind === "reset" ? event.source : event.scenario ?? event.source}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={event.kind === "reset" ? "outline" : "destructive"}
                      className="font-mono text-[10px] uppercase"
                    >
                      {event.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnomalyPage() {
  const { data, isLoading } = useQuery(healthQueryOptions);
  const [events, setEvents] = useState<InjectionEvent[]>([]);
  const [activeInjections, setActiveInjections] = useState<ActiveInjection[]>([]);

  const services = data?.services;
  const degradedServices = services
    ? Object.values(services).filter((status) => status !== "healthy").length
    : 0;
  const healthyServices = services
    ? Object.values(services).filter((status) => status === "healthy").length
    : 0;

  function pushEvents(nextEvents: InjectionEvent[]) {
    setEvents((current) => [...nextEvents, ...current]);
  }

  function handleInjected(event: ActiveInjection) {
    setActiveInjections((current) => [
      event,
      ...current.filter((entry) => entry.service !== event.service),
    ]);
    pushEvents([event]);
  }

  function handleScenarioInjected(nextEvents: ActiveInjection[]) {
    if (nextEvents.length === 0) return;

    setActiveInjections((current) => {
      const nextByService = new Map(current.map((entry) => [entry.service, entry]));

      nextEvents.forEach((entry) => {
        nextByService.set(entry.service, entry);
      });

      return Array.from(nextByService.values());
    });

    pushEvents(nextEvents);
  }

  function handleReset() {
    setActiveInjections([]);
    pushEvents([
      {
        id: buildEventId("reset"),
        kind: "reset",
        source: "system",
        status: "reset",
        timestamp: Date.now(),
      },
    ]);
  }

  return (
    <PageMount className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title="Anomaly Injection"
        description="Dense control surface for single-service faults and dependency cascades."
        meta={
          <>
            <PageMetaCell label="Tracked faults" value={activeInjections.length} />
            <PageMetaCell label="Scenarios" value="1" />
            <PageMetaCell label="Journal" value={events.length} />
          </>
        }
      />

      <LiveStatusPanel />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Live faults"
          value={activeInjections.length}
          sublabel="local tracked injections"
        />
        <StatCard
          label="Degraded"
          value={isLoading ? "…" : degradedServices}
          sublabel="targets outside healthy state"
        />
        <StatCard
          label="Healthy"
          value={isLoading ? "…" : healthyServices}
          sublabel="available services"
        />
        <StatCard
          label="Blast radius"
          value={activeInjections.length > 0 ? activeInjections.length : "0"}
          sublabel="services carrying injected fault"
        />
      </div>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
        <div className="space-y-3">
          <InjectForm
            activeInjections={activeInjections}
            serviceStatuses={services}
            onInjected={handleInjected}
          />

          <HistoryCard events={events} />
        </div>

        <div className="space-y-3">
          <ScenarioButtons
            onReset={handleReset}
            onScenarioInjected={handleScenarioInjected}
          />

          <ActiveAnomaliesCard activeInjections={activeInjections} />

          <ServiceTargetsCard
            activeInjections={activeInjections}
            serviceStatuses={services}
          />
        </div>
      </div>

      {data?.status === "degraded" ? (
        <div className="flex items-center gap-2 bg-status-degraded-soft px-3 py-2 font-mono text-[11px] text-status-degraded ring-1 ring-inset ring-status-degraded/20">
          <AlertTriangle className="h-3.5 w-3.5" />
          System already degraded. New injections stack on top of live instability.
        </div>
      ) : null}

      {events.length > 0 ? (
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <History className="h-3.5 w-3.5" />
          Last action {formatEventTime(events[0].timestamp)}
        </div>
      ) : (
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          <Target className="h-3.5 w-3.5" />
          Ready for controlled failure injection
        </div>
      )}
    </PageMount>
  );
}
