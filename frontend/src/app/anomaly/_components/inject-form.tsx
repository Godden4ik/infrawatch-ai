"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Radar, ShieldAlert, Syringe } from "lucide-react";
import { injectAnomaly } from "@/services/anomaly/actions";
import { unwrap } from "@/services/_shared/safe-action";
import { ANOMALY_TYPES, SERVICES } from "@/services/anomaly/schema";
import { healthKeys } from "@/services/health/query-options";
import type { HealthResponse } from "@/services/health/schema";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ActiveInjection, InjectResponse } from "./types";

const ANOMALY_COPY: Record<
  string,
  { label: string; summary: string; effect: string }
> = {
  latency: {
    label: "Latency Spike",
    summary: "Raises response time without forcing hard failure.",
    effect: "Best for pipeline timing regressions and degraded traces.",
  },
  error: {
    label: "Error Burst",
    summary: "Pushes request failures through service edge.",
    effect: "Useful for alerting, fallback, and retry path checks.",
  },
  memory_leak: {
    label: "Memory Leak",
    summary: "Creates sustained resource pressure over time.",
    effect: "Useful for drift detection and remediation runbooks.",
  },
  cache_failure: {
    label: "Cache Failure",
    summary: "Removes cache dependency from service path.",
    effect: "Sharp blast radius. Good for cascade verification.",
  },
  cache_degraded: {
    label: "Cache Degraded",
    summary: "Keeps cache online with weak performance and misses.",
    effect: "Tests partial failure handling without total outage.",
  },
};

const SERVICE_LABELS: Record<string, string> = {
  "api-gateway": "API Gateway",
  "payment-service": "Payment Service",
  "user-service": "User Service",
  "order-service": "Order Service",
  "redis-cache": "Redis Cache",
};

function buildEventId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function statusDot(status: HealthResponse["services"][string] | undefined) {
  if (status === "healthy") return "bg-emerald-500";
  if (status === "unhealthy") return "bg-amber-500";
  return "bg-muted-foreground";
}

function statusLabel(status: HealthResponse["services"][string] | undefined) {
  return status ?? "unknown";
}

interface InjectFormProps {
  activeInjections: ActiveInjection[];
  serviceStatuses?: HealthResponse["services"];
  onInjected: (event: ActiveInjection) => void;
}

export function InjectForm({
  activeInjections,
  serviceStatuses,
  onInjected,
}: InjectFormProps) {
  const [service, setService] = useState<string>(SERVICES[0]);
  const [anomalyType, setAnomalyType] = useState<string>(ANOMALY_TYPES[0]);
  const queryClient = useQueryClient();

  const selectedAnomaly = ANOMALY_COPY[anomalyType];
  const selectedStatus = serviceStatuses?.[service];
  const selectedActiveInjection = activeInjections.find(
    (entry) => entry.service === service,
  );
  const selectedServiceLabel = SERVICE_LABELS[service] ?? service;

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await injectAnomaly(service, anomalyType);
      const data = unwrap(result) as InjectResponse;

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: healthKeys.all });
      toast.success(`Injection accepted for ${selectedServiceLabel}.`);
      onInjected({
        id: buildEventId("inject"),
        kind: "inject",
        service: data.service ?? service,
        anomalyType: data.anomaly_type ?? anomalyType,
        source: "manual",
        status: data.status ?? "injected",
        timestamp: Date.now(),
      });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  return (
    <Card size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Manual Injection</CardTitle>
        <CardDescription>
          Target single service. Keep blast radius tight for focused checks.
        </CardDescription>
        <CardAction>
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/10 font-mono text-[10px] uppercase tracking-[0.14em] text-primary"
          >
            Single target
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-4 pt-3">
        <div className="grid gap-3 xl:grid-cols-[1fr_1fr]">
          <div className="space-y-1.5">
            <label className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Target service
            </label>
            <Select
              value={service}
              onValueChange={(value) => {
                if (value) setService(value);
              }}
            >
              <SelectTrigger className="w-full">
                <span className="truncate">
                  {selectedServiceLabel || "Select service"}
                </span>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  <SelectLabel>Services</SelectLabel>
                  {SERVICES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      <div className="flex w-full items-center justify-between gap-3">
                        <span className="font-mono">
                          {SERVICE_LABELS[entry] ?? entry}
                        </span>
                        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                          <span
                            className={cn(
                              "h-1.5 w-1.5 shrink-0 rounded-full",
                              statusDot(serviceStatuses?.[entry]),
                            )}
                          />
                          {statusLabel(serviceStatuses?.[entry])}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Anomaly type
            </label>
            <Select
              value={anomalyType}
              onValueChange={(value) => {
                if (value) setAnomalyType(value);
              }}
            >
              <SelectTrigger className="w-full">
                <span className="truncate">
                  {selectedAnomaly.label || "Select anomaly"}
                </span>
              </SelectTrigger>
              <SelectContent align="start">
                <SelectGroup>
                  <SelectLabel>Anomalies</SelectLabel>
                  {ANOMALY_TYPES.map((entry) => (
                    <SelectItem key={entry} value={entry}>
                      <div className="flex flex-col items-start gap-0.5">
                        <span>{ANOMALY_COPY[entry].label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {entry.replace(/_/g, " ")}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-2 bg-muted/30 px-3 py-3 ring-1 ring-inset ring-border/60">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Radar className="h-3.5 w-3.5 text-primary" />
                <span className="font-mono text-xs">{selectedServiceLabel}</span>
              </div>
              <Badge variant="outline" className="font-mono text-[10px] uppercase">
                {statusLabel(selectedStatus)}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              <div className="bg-background/60 px-2 py-2 ring-1 ring-inset ring-border/60">
                Service state
                <div className="mt-1 flex items-center gap-1.5 text-foreground">
                  <span
                    className={cn("h-1.5 w-1.5 rounded-full", statusDot(selectedStatus))}
                  />
                  {statusLabel(selectedStatus)}
                </div>
              </div>
              <div className="bg-background/60 px-2 py-2 ring-1 ring-inset ring-border/60">
                Existing fault
                <div className="mt-1 text-foreground">
                  {selectedActiveInjection
                    ? selectedActiveInjection.anomalyType.replace(/_/g, " ")
                    : "none"}
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2 bg-muted/30 px-3 py-3 ring-1 ring-inset ring-border/60">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" />
              <span className="text-xs font-medium">{selectedAnomaly.label}</span>
            </div>
            <p className="text-xs text-muted-foreground">{selectedAnomaly.summary}</p>
            <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
              Effect
            </p>
            <p className="text-xs text-foreground">{selectedAnomaly.effect}</p>
          </div>
        </div>

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending}
          size="lg"
          className="w-full justify-center gap-2"
        >
          {mutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Syringe className="h-4 w-4" />
          )}
          Inject anomaly
        </Button>
      </CardContent>
    </Card>
  );
}
