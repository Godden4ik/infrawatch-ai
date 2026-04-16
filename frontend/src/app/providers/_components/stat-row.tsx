"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Provider } from "@/services/providers/schema";

interface StatRowProps {
  providers: Provider[] | undefined;
  configuredIds: Set<string>;
  healthyIds: Set<string>;
  isLoading: boolean;
}

function StatCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="mt-1.5 font-mono text-2xl font-semibold tabular-nums leading-none text-foreground">
          {value}
        </p>
        {sub && (
          <p className="mt-1 font-mono text-[10px] text-muted-foreground">
            {sub}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="p-0">
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-7 w-12" />
        <Skeleton className="h-2 w-16" />
      </CardContent>
    </Card>
  );
}

export function StatRow({
  providers,
  configuredIds,
  healthyIds,
  isLoading,
}: StatRowProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const total = providers?.length ?? 0;
  const configured = configuredIds.size;
  const healthy = healthyIds.size;
  const totalModels =
    providers?.reduce((sum, p) => sum + p.models.length, 0) ?? 0;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        label="Total Providers"
        value={total}
        sub={total === 1 ? "1 provider registered" : `${total} providers registered`}
      />
      <StatCard
        label="Configured"
        value={configured}
        sub={`${total - configured} need a key`}
      />
      <StatCard
        label="Healthy"
        value={
          <span className={healthy > 0 ? "text-emerald-500" : "text-muted-foreground"}>
            {healthy}
          </span>
        }
        sub="passed health check"
      />
      <StatCard
        label="Available Models"
        value={totalModels}
        sub="across all providers"
      />
    </div>
  );
}
