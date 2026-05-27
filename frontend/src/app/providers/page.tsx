"use client";

import { useQuery } from "@tanstack/react-query";
import { providerQueries } from "@/services/providers/query-options";
import { getKeyStatus } from "@/services/providers/actions";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import { PageMount } from "@/components/layout/page-mount";
import { StatRow } from "./_components/stat-row";
import { ProviderCard } from "./_components/provider-card";
import { useEffect, useState } from "react";

export default function ProvidersPage() {
  const { data: providersData, isLoading } = useQuery(providerQueries.list());

  // Track which providers have a SQLite-stored key
  const [sqliteKeyIds, setSqliteKeyIds] = useState<Set<string>>(new Set());
  const [healthyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getKeyStatus().then((result) => {
      if (result.success) {
        const ids = new Set(
          result.data
            .filter((entry) => entry.hasKey)
            .map((entry) => entry.providerId),
        );
        setSqliteKeyIds(ids);
      }
    });
  }, []);

  // A provider is "configured" if it has a runtime (sqlite) key
  const configuredIds = sqliteKeyIds;

  return (
    <PageMount className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Providers"
        description="Manage LLM provider API keys and connectivity"
      />

      {/* ── Stat row ────────────────────────────────────────────────────── */}
      <StatRow
        providers={providersData?.providers}
        configuredIds={configuredIds}
        healthyIds={healthyIds}
        isLoading={isLoading}
      />

      {/* ── Provider cards grid ─────────────────────────────────────────── */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full" />
          ))}
        </div>
      ) : providersData && providersData.providers.length > 0 ? (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {providersData.providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              hasSqliteKey={sqliteKeyIds.has(provider.id)}
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="font-mono text-sm text-muted-foreground">
            No providers registered.
          </p>
          <p className="mt-1 font-mono text-xs text-muted-foreground/50">
            Check backend configuration.
          </p>
        </div>
      )}
    </PageMount>
  );
}
