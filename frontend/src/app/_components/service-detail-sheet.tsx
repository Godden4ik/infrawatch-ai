"use client";

import Link from "next/link";
import { Activity, Network, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  StatusBar,
  StatusPill,
  type StatusVariant,
} from "@/components/ui/status-indicator";

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

export function ServiceDetailSheet({
  open,
  onOpenChange,
  service,
}: ServiceDetailSheetProps) {
  if (!service) return null;

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
            Deep dive — live health, recent activity, and quick actions.
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
              Recent Activity
            </p>
            <ul className="space-y-1.5 font-mono text-xs text-muted-foreground">
              <li>
                · Last anomaly injected —{" "}
                <span className="text-foreground/70">—</span>
              </li>
              <li>
                · Pipeline runs today —{" "}
                <span className="text-foreground/70">—</span>
              </li>
              <li>
                · Linked runbooks —{" "}
                <span className="text-foreground/70">—</span>
              </li>
            </ul>
          </section>

          <section className="space-y-2">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
              Quick Actions
            </p>
            <div className="grid gap-2">
              <Button
                render={
                  <Link href="/topology">
                    <Network className="h-3.5 w-3.5" />
                    View on Topology
                  </Link>
                }
              />
              <Button
                variant="outline"
                render={
                  <Link href="/dashboard">
                    <Activity className="h-3.5 w-3.5" />
                    View Metrics
                  </Link>
                }
              />
              <Button
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
