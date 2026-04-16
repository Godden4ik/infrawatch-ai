"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flame, Loader2, RotateCcw, Workflow } from "lucide-react";
import { injectScenario, resetAnomalies } from "@/services/anomaly/actions";
import { unwrap } from "@/services/_shared/safe-action";
import { healthKeys } from "@/services/health/query-options";
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
import { Separator } from "@/components/ui/separator";
import type {
  ActiveInjection,
  InjectResponse,
  ResetResponse,
  ScenarioResponse,
} from "./types";

function buildEventId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ScenarioButtonsProps {
  onReset: () => void;
  onScenarioInjected: (events: ActiveInjection[]) => void;
}

export function ScenarioButtons({
  onReset,
  onScenarioInjected,
}: ScenarioButtonsProps) {
  const queryClient = useQueryClient();

  const cascadeMutation = useMutation({
    mutationFn: async () => {
      const result = await injectScenario("cascade");
      const data = unwrap(result) as ScenarioResponse;

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: healthKeys.all });

      const events =
        data.results
          ?.filter(
            (entry): entry is InjectResponse & {
              service: string;
              anomaly_type: string;
            } =>
              !!entry?.service &&
              !!entry?.anomaly_type &&
              !entry.error,
          )
          .map((entry) => ({
            id: buildEventId("scenario"),
            kind: "inject" as const,
            service: entry.service,
            anomalyType: entry.anomaly_type,
            source: "scenario" as const,
            scenario: data.scenario ?? "cascade",
            status: entry.status ?? "injected",
            timestamp: Date.now(),
          })) ?? [];

      onScenarioInjected(events);
    },
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      const result = await resetAnomalies();
      const data = unwrap(result) as ResetResponse;

      if (data.error) {
        throw new Error(data.error);
      }

      return data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: healthKeys.all });
      onReset();
    },
  });

  return (
    <Card size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Preset Scenarios</CardTitle>
        <CardDescription>
          Fire multi-service faults for blast-radius and dependency checks.
        </CardDescription>
        <CardAction>
          <Badge
            variant="outline"
            className="font-mono text-[10px] uppercase tracking-[0.14em]"
          >
            Orchestrated
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        <div className="space-y-2 bg-muted/30 px-3 py-3 ring-1 ring-inset ring-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Workflow className="h-3.5 w-3.5 text-destructive" />
                <span className="text-xs font-medium">Cascade failure</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Redis fails first. Payment and order degrade next.
              </p>
            </div>
            <Badge variant="destructive" className="font-mono text-[10px] uppercase">
              3 hops
            </Badge>
          </div>

          <div className="grid grid-cols-3 gap-2 font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
            <div className="bg-background/60 px-2 py-2 ring-1 ring-inset ring-border/60">
              Root
              <div className="mt-1 text-foreground">redis</div>
            </div>
            <div className="bg-background/60 px-2 py-2 ring-1 ring-inset ring-border/60">
              Spread
              <div className="mt-1 text-foreground">payment</div>
            </div>
            <div className="bg-background/60 px-2 py-2 ring-1 ring-inset ring-border/60">
              Spread
              <div className="mt-1 text-foreground">order</div>
            </div>
          </div>

          <Button
            onClick={() => cascadeMutation.mutate()}
            disabled={cascadeMutation.isPending || resetMutation.isPending}
            variant="destructive"
            size="lg"
            className="w-full justify-center gap-2"
          >
            {cascadeMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Flame className="h-4 w-4" />
            )}
            Inject cascade
          </Button>
        </div>

        <Separator />

        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Recovery
          </p>
          <Button
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending || cascadeMutation.isPending}
            variant="outline"
            size="lg"
            className="w-full justify-center gap-2"
          >
            {resetMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            Reset all services
          </Button>
        </div>

        {cascadeMutation.isSuccess ? (
          <div className="bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-500 ring-1 ring-inset ring-emerald-500/20">
            Cascade scenario accepted.
          </div>
        ) : null}

        {resetMutation.isSuccess ? (
          <div className="bg-emerald-500/10 px-3 py-2 font-mono text-[11px] text-emerald-500 ring-1 ring-inset ring-emerald-500/20">
            Reset issued across all services.
          </div>
        ) : null}

        {cascadeMutation.isError ? (
          <div className="bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive ring-1 ring-inset ring-destructive/20">
            {cascadeMutation.error.message}
          </div>
        ) : null}

        {resetMutation.isError ? (
          <div className="bg-destructive/10 px-3 py-2 font-mono text-[11px] text-destructive ring-1 ring-inset ring-destructive/20">
            {resetMutation.error.message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
