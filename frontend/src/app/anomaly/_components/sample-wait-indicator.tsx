"use client";

import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

const DEFAULT_DURATION_MS = 15_000;

export interface SampleWaitIndicatorProps {
  /** Timestamp (ms since epoch) when the injection landed. Pass `null` to hide. */
  startedAt: number | null;
  /** Total expected wait window. Defaults to 15 s. */
  durationMs?: number;
  label?: string;
  className?: string;
}

export function SampleWaitIndicator({
  startedAt,
  durationMs = DEFAULT_DURATION_MS,
  label = "Awaiting next Prometheus sample",
  className,
}: SampleWaitIndicatorProps) {
  const reduce = useReducedMotion();
  const [now, setNow] = useState<number>(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;
  const elapsed = now - startedAt;
  if (elapsed >= durationMs) return null;

  const remainingSec = Math.max(0, Math.ceil((durationMs - elapsed) / 1000));
  const progress = Math.min(1, Math.max(0, elapsed / durationMs));

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "border border-border/60 bg-muted/30 px-3 py-2",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em]">
        <span className="text-muted-foreground/80">{label}</span>
        <span className="tabular-nums text-foreground/80">{remainingSec}s</span>
      </div>
      <div className="mt-1.5 h-px overflow-hidden bg-border/40">
        <div
          className="h-full bg-brand"
          style={{
            width: `${progress * 100}%`,
            transition: reduce ? "none" : "width 250ms linear",
          }}
        />
      </div>
    </div>
  );
}
