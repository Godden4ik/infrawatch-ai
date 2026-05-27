import { cn } from "@/lib/utils";

export type StatusVariant = "healthy" | "degraded" | "critical" | "unknown";

const dotBg: Record<StatusVariant, string> = {
  healthy: "bg-status-healthy",
  degraded: "bg-status-degraded",
  critical: "bg-status-critical",
  unknown: "bg-status-unknown",
};

const pillSurface: Record<StatusVariant, string> = {
  healthy: "bg-status-healthy-soft text-status-healthy",
  degraded: "bg-status-degraded-soft text-status-degraded",
  critical: "bg-status-critical-soft text-status-critical",
  unknown: "bg-status-unknown-soft text-status-unknown",
};

const barColor: Record<StatusVariant, string> = {
  healthy: "bg-status-healthy",
  degraded: "bg-status-degraded",
  critical: "bg-status-critical",
  unknown: "bg-status-unknown",
};

export function StatusDot({
  variant,
  size = "sm",
  pulse = false,
  className,
}: {
  variant: StatusVariant;
  size?: "sm" | "md";
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full",
        size === "sm" ? "h-2 w-2" : "h-2.5 w-2.5",
        dotBg[variant],
        pulse && "animate-pulse",
        className,
      )}
    />
  );
}

export function StatusPill({
  variant,
  pulse = false,
  children,
  className,
}: {
  variant: StatusVariant;
  pulse?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 border border-current/20 px-2 py-0.5",
        "font-mono text-[10px] uppercase tracking-[0.14em]",
        pillSurface[variant],
        className,
      )}
    >
      <StatusDot variant={variant} size="sm" pulse={pulse} />
      <span className="text-current">{children}</span>
    </span>
  );
}

export function StatusBar({
  variant,
  className,
}: {
  variant: StatusVariant;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 w-[3px]",
        barColor[variant],
        className,
      )}
    />
  );
}
