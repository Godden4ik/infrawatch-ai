"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { healthQueryOptions } from "@/services/health/query-options";
import { providerQueries } from "@/services/providers/query-options";
import { getKeyStatus } from "@/services/providers/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Shield,
  CreditCard,
  User,
  Package,
  Server,
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from "lucide-react";
import { SiRedis, SiPrometheus, SiNeo4J } from "react-icons/si";
import type { ComponentType, SVGProps } from "react";

// ─── Icon mapping ─────────────────────────────────────────────────────────────

type LucideIconProps = {
  className?: string;
  size?: number | string;
};
type SiIconProps = SVGProps<SVGSVGElement> & { className?: string };

const MICROSERVICE_ICONS: Record<
  string,
  ComponentType<LucideIconProps | SiIconProps>
> = {
  "api-gateway": Shield as ComponentType<LucideIconProps | SiIconProps>,
  "payment-service": CreditCard as ComponentType<LucideIconProps | SiIconProps>,
  "user-service": User as ComponentType<LucideIconProps | SiIconProps>,
  "order-service": Package as ComponentType<LucideIconProps | SiIconProps>,
  "redis-cache": SiRedis as ComponentType<LucideIconProps | SiIconProps>,
};

const INFRA_ICONS: Record<
  string,
  ComponentType<LucideIconProps | SiIconProps>
> = {
  prometheus: SiPrometheus as ComponentType<LucideIconProps | SiIconProps>,
  neo4j: SiNeo4J as ComponentType<LucideIconProps | SiIconProps>,
};

const MICROSERVICES = [
  "api-gateway",
  "payment-service",
  "user-service",
  "order-service",
  "redis-cache",
];

const INFRA_SERVICES = ["prometheus", "neo4j"];

// ─── Status helpers ────────────────────────────────────────────────────────────

type ServiceStatus = "healthy" | "unhealthy" | "unreachable";

function statusColor(status: ServiceStatus) {
  if (status === "healthy") return "text-emerald-500";
  if (status === "unhealthy") return "text-amber-500";
  return "text-destructive";
}

function statusDotClass(status: ServiceStatus) {
  if (status === "healthy")
    return "bg-emerald-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]";
  if (status === "unhealthy")
    return "bg-amber-500 shadow-[0_0_5px_rgba(245,158,11,0.6)]";
  return "bg-destructive shadow-[0_0_5px_rgba(239,68,68,0.5)]";
}

function overallStatusIcon(status: "healthy" | "degraded" | undefined) {
  if (status === "healthy")
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />;
  if (status === "degraded")
    return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
  return <XCircle className="h-3.5 w-3.5 text-muted-foreground" />;
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: "emerald" | "amber" | "muted";
}) {
  const valueClass =
    accent === "emerald"
      ? "text-emerald-500"
      : accent === "amber"
        ? "text-amber-500"
        : "text-foreground";

  return (
    <Card className="p-0">
      <CardContent className="p-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums leading-none ${valueClass}`}
        >
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

function ServiceCard({
  name,
  status,
}: {
  name: string;
  status: ServiceStatus;
}) {
  const Icon =
    MICROSERVICE_ICONS[name] ??
    (Server as ComponentType<LucideIconProps | SiIconProps>);

  return (
    <Card className="p-0">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              size={14}
            />
            <span className="font-mono text-xs truncate">{name}</span>
          </div>
          <span
            className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(status)}`}
          />
        </div>
        <p
          className={`mt-2 font-mono text-[10px] uppercase tracking-wider ${statusColor(status)}`}
        >
          {status}
        </p>
      </CardContent>
    </Card>
  );
}

function InfraRow({
  name,
  status,
}: {
  name: string;
  status: ServiceStatus | undefined;
}) {
  const Icon =
    INFRA_ICONS[name] ??
    (Activity as ComponentType<LucideIconProps | SiIconProps>);
  const resolvedStatus: ServiceStatus = status ?? "unreachable";

  return (
    <div className="flex items-center gap-3 rounded-[var(--radius)] bg-muted/40 px-3 py-2">
      <Icon
        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
        size={14}
      />
      <span className="font-mono text-xs flex-1">{name}</span>
      <span
        className={`h-1.5 w-1.5 shrink-0 rounded-full ${statusDotClass(resolvedStatus)}`}
      />
      <span
        className={`font-mono text-[10px] uppercase tracking-wider ${statusColor(resolvedStatus)}`}
      >
        {resolvedStatus}
      </span>
    </div>
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

function ServiceCardSkeleton() {
  return (
    <Card className="p-0">
      <CardContent className="p-3 space-y-2">
        <div className="flex justify-between items-center">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-1.5 w-1.5 rounded-full" />
        </div>
        <Skeleton className="h-2.5 w-14" />
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const { data, isLoading, error } = useQuery(healthQueryOptions);
  const { data: providersData, isLoading: isLoadingProviders } = useQuery(
    providerQueries.list(),
  );
  const [sqliteKeyIds, setSqliteKeyIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    getKeyStatus().then((result) => {
      if (result.success) {
        setSqliteKeyIds(
          new Set(
            result.data
              .filter((entry) => entry.hasKey)
              .map((entry) => entry.providerId),
          ),
        );
      }
    });
  }, []);

  const healthyCount = data
    ? Object.values(data.services).filter((s) => s === "healthy").length
    : 0;
  const totalCount = data ? Object.keys(data.services).length : 0;

  const microservices = data
    ? MICROSERVICES.filter((s) => s in data.services)
    : [];
  const infraServices = data
    ? INFRA_SERVICES.filter((s) => s in data.services)
    : [];

  const configuredProviders = providersData
    ? providersData.providers.filter(
        (provider) => !provider.requires_key || sqliteKeyIds.has(provider.id),
      ).length
    : null;

  const systemStatus = data?.status;
  const statusAccent =
    systemStatus === "healthy"
      ? "emerald"
      : systemStatus === "degraded"
        ? "amber"
        : "muted";

  return (
    <motion.div
      className="mx-auto max-w-6xl space-y-5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.25 }}
    >
      {/* ── Page header ──────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-base font-semibold">System Overview</h1>
        <p className="text-xs text-muted-foreground">
          Real-time infrastructure health across all monitored services
        </p>
      </div>

      {/* ── Stat row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))
        ) : (
          <>
            <StatCard
              label="Services Online"
              value={
                data ? (
                  <>
                    <span className="text-emerald-500">{healthyCount}</span>
                    <span className="text-muted-foreground text-lg">
                      /{totalCount}
                    </span>
                  </>
                ) : (
                  "—"
                )
              }
              sub={data ? `${totalCount - healthyCount} degraded or down` : undefined}
              accent="muted"
            />

            <StatCard
              label="System Status"
              value={
                <span className="flex items-center gap-1.5">
                  {overallStatusIcon(systemStatus)}
                  <span
                    className={
                      statusAccent === "emerald"
                        ? "text-emerald-500"
                        : statusAccent === "amber"
                          ? "text-amber-500"
                          : "text-muted-foreground"
                    }
                  >
                    {systemStatus ?? "—"}
                  </span>
                </span>
              }
              sub={
                systemStatus === "healthy"
                  ? "all systems nominal"
                  : systemStatus === "degraded"
                    ? "partial outage detected"
                    : undefined
              }
            />

            <StatCard
              label="Configured Providers"
              value={isLoadingProviders ? "…" : (configuredProviders ?? "—")}
              sub={
                providersData
                  ? `${providersData.providers.length - (configuredProviders ?? 0)} need setup`
                  : undefined
              }
            />

            <StatCard
              label="Pipeline Runs"
              value="—"
              sub="no runs recorded today"
            />
          </>
        )}
      </div>

      {/* ── Error banner ─────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-[var(--radius)] bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive">
          Failed to fetch health data: {error.message}
        </div>
      )}

      {/* ── Service health grid ───────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Microservices
        </p>
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <ServiceCardSkeleton key={i} />
            ))}
          </div>
        ) : data ? (
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-4">
            {microservices.map((name) => (
              <ServiceCard
                key={name}
                name={name}
                status={data.services[name]}
              />
            ))}
          </div>
        ) : null}
      </div>

      {/* ── Infrastructure section ────────────────────────────────────────── */}
      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Infrastructure
        </p>
        {isLoading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-[var(--radius)] bg-muted/40 px-3 py-2">
                <Skeleton className="h-3 w-40" />
              </div>
            ))}
          </div>
        ) : data ? (
          <div className="space-y-1.5">
            {infraServices.map((name) => (
              <InfraRow key={name} name={name} status={data.services[name]} />
            ))}
            {infraServices.length === 0 && (
              <p className="font-mono text-xs text-muted-foreground">
                No infrastructure services detected.
              </p>
            )}
          </div>
        ) : null}
      </div>

      {/* ── Provider chips ────────────────────────────────────────────────── */}
      {providersData && providersData.providers.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            LLM Providers
          </p>
          <div className="flex flex-wrap gap-2">
            {providersData.providers.map((provider) => (
              <div
                key={provider.id}
                className="flex items-center gap-2 rounded-[var(--radius)] bg-muted/40 px-3 py-1.5"
              >
                {(() => {
                  const configured =
                    !provider.requires_key || sqliteKeyIds.has(provider.id);
                  const healthy = provider.available;

                  return (
                    <>
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          configured && healthy
                            ? "bg-emerald-500 shadow-[0_0_5px_rgba(34,197,94,0.6)]"
                            : configured
                              ? "bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.45)]"
                              : "bg-muted-foreground"
                        }`}
                      />
                      <span className="font-mono text-xs">{provider.name}</span>
                      {!provider.requires_key ? (
                        <span className="text-[9px] uppercase tracking-wider text-blue-400">
                          local
                        </span>
                      ) : configured ? (
                        <span className="text-[9px] uppercase tracking-wider text-blue-400">
                          configured
                        </span>
                      ) : (
                        <span className="text-[9px] uppercase tracking-wider text-amber-500">
                          no key
                        </span>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Refresh note ──────────────────────────────────────────────────── */}
      <p className="font-mono text-[10px] text-muted-foreground/50">
        Auto-refreshes every 30s &middot; Last updated:{" "}
        <span suppressHydrationWarning>{new Date().toLocaleTimeString()}</span>
      </p>
    </motion.div>
  );
}
