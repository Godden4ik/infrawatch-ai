import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div className="space-y-1.5">
        {eyebrow && (
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground/80">
            {eyebrow}
          </p>
        )}
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {(actions || meta) && (
        <div className="flex flex-wrap items-center gap-2">
          {meta}
          {actions}
        </div>
      )}
    </div>
  );
}

export function PageMetaCell({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="border border-border/70 bg-card/50 px-3 py-1.5 font-mono text-[10px]">
      <div className="uppercase tracking-[0.16em] text-muted-foreground/80">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-foreground">{value}</div>
    </div>
  );
}
