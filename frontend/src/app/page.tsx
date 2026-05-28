"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { healthQueryOptions } from "@/services/health/query-options";
import { providerQueries } from "@/services/providers/query-options";
import { getKeyStatus } from "@/services/providers/actions";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  StatusDot,
  StatusPill,
  type StatusVariant,
} from "@/components/ui/status-indicator";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { PageMount } from "@/components/layout/page-mount";
import { PageHeader } from "@/components/layout/page-header";
import {
  Shield,
  CreditCard,
  User,
  Package,
  Server,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ExternalLink,
} from "lucide-react";
import { SiRedis } from "react-icons/si";
import {
  useExternalServices,
  type ExternalService,
} from "@/lib/external-services-context";
import {
  ServiceDetailSheet,
  type ServiceDetailSheetService,
} from "@/app/_components/service-detail-sheet";
import type { ComponentType, SVGProps } from "react";

type LucideIconProps = { className?: string; size?: number | string };
type SiIconProps = SVGProps<SVGSVGElement> & { className?: string };
type IconComponent = ComponentType<LucideIconProps | SiIconProps>;

const MICROSERVICE_ICONS: Record<string, IconComponent> = {
  "api-gateway": Shield as IconComponent,
  "payment-service": CreditCard as IconComponent,
  "user-service": User as IconComponent,
  "order-service": Package as IconComponent,
  "redis-cache": SiRedis as IconComponent,
};

const MICROSERVICES = [
  "api-gateway",
  "payment-service",
  "user-service",
  "order-service",
  "redis-cache",
];

type ServiceStatus = "healthy" | "unhealthy" | "unreachable";

function toVariant(status: ServiceStatus | undefined): StatusVariant {
  if (status === "healthy") return "healthy";
  if (status === "unhealthy") return "degraded";
  if (status === "unreachable") return "critical";
  return "unknown";
}

function systemIcon(status: "healthy" | "degraded" | undefined) {
  const cls = "h-3.5 w-3.5";
  if (status === "healthy")
    return <CheckCircle2 className={`${cls} text-status-healthy`} />;
  if (status === "degraded")
    return <AlertTriangle className={`${cls} text-status-degraded`} />;
  return <XCircle className={`${cls} text-muted-foreground`} />;
}

function StatCard({
  label,
  value,
  sub,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  tone?: "default" | "brand" | "healthy" | "degraded" | "critical";
}) {
  return (
    <Card tone={tone} className="p-0">
      <CardContent className="p-3">
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
          {label}
        </p>
        <div className="mt-1.5 font-mono text-2xl font-semibold tabular-nums leading-none tracking-tight">
          {value}
        </div>
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
  serviceId,
  onSelect,
}: {
  name: string;
  status: ServiceStatus;
  serviceId: string;
  onSelect: () => void;
}) {
  const Icon = MICROSERVICE_ICONS[name] ?? (Server as IconComponent);
  const variant = toVariant(status);

  return (
    <Card
      tone={status === "unreachable" ? "critical" : status === "unhealthy" ? "degraded" : "default"}
      className="p-0 transition-colors focus-within:ring-2 focus-within:ring-ring hover:bg-muted/30"
      style={{ viewTransitionName: `node-${serviceId}` }}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-label={`View details for ${name}`}
        className="block w-full cursor-pointer text-left outline-none"
      >
        <CardContent className="p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Icon
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                size={14}
              />
              <span className="truncate font-mono text-xs">{name}</span>
            </div>
            <StatusDot variant={variant} size="sm" />
          </div>
          <p
            className={`mt-2 font-mono text-[10px] uppercase tracking-[0.14em] ${
              variant === "healthy"
                ? "text-status-healthy"
                : variant === "degraded"
                  ? "text-status-degraded"
                  : "text-status-critical"
            }`}
          >
            {status}
          </p>
        </CardContent>
      </button>
    </Card>
  );
}

function ExternalServiceCard({
  service,
  healthVariant,
  onSelect,
}: {
  service: ExternalService;
  healthVariant: StatusVariant | null;
  onSelect: () => void;
}) {
  const Icon = service.icon;
  return (
    <div className="group relative flex items-center justify-between gap-3 border border-border/60 bg-muted/30 transition-colors focus-within:border-border hover:border-border hover:bg-muted/50">
      <button
        type="button"
        onClick={onSelect}
        aria-label={`View details for ${service.label}`}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-foreground">
            {service.label}
          </p>
          <p className="truncate text-[10px] text-muted-foreground">
            {service.description}
          </p>
        </div>
      </button>
      <div className="flex items-center gap-2 pr-3">
        {healthVariant && <StatusDot variant={healthVariant} size="sm" />}
        <a
          href={service.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          aria-label={`Open ${service.label} in new tab`}
          className="inline-flex h-6 w-6 items-center justify-center text-muted-foreground/60 outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink className="h-3 w-3 shrink-0" />
        </a>
      </div>
    </div>
  );
}

function StatCardSkeleton() {
  return (
    <Card className="p-0">
      <CardContent className="space-y-2 p-3">
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
      <CardContent className="space-y-2 p-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-1.5 w-1.5 rounded-full" />
        </div>
        <Skeleton className="h-2.5 w-14" />
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  const { data, isLoading, error } = useQuery(healthQueryOptions);
  const { data: providersData, isLoading: isLoadingProviders } = useQuery(
    providerQueries.list(),
  );
  const externalServices = useExternalServices();
  const [sqliteKeyIds, setSqliteKeyIds] = useState<Set<string>>(new Set());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [selectedService, setSelectedService] =
    useState<ServiceDetailSheetService | null>(null);

  const openServiceSheet = (service: ServiceDetailSheetService) => {
    setSelectedService(service);
    setSheetOpen(true);
  };

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

  const configuredProviders = providersData
    ? providersData.providers.filter(
        (provider) => !provider.requires_key || sqliteKeyIds.has(provider.id),
      ).length
    : null;

  const systemStatus = data?.status;
  const systemTone: "default" | "healthy" | "degraded" | "critical" =
    systemStatus === "healthy"
      ? "healthy"
      : systemStatus === "degraded"
        ? "degraded"
        : "default";

  return (
    <PageMount className="mx-auto max-w-6xl space-y-5">
      <PageHeader
        title="System Overview"
        description="Real-time infrastructure health across all monitored services"
      />

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
                  <span className="flex items-baseline gap-1">
                    <span className="text-status-healthy">
                      <AnimatedNumber value={healthyCount} />
                    </span>
                    <span className="text-lg text-muted-foreground">
                      /{totalCount}
                    </span>
                  </span>
                ) : (
                  "—"
                )
              }
              sub={
                data
                  ? `${totalCount - healthyCount} degraded or down`
                  : undefined
              }
              tone={systemTone}
            />

            <StatCard
              label="System Status"
              value={
                <span className="flex items-center gap-1.5">
                  {systemIcon(systemStatus)}
                  <span
                    className={
                      systemStatus === "healthy"
                        ? "text-status-healthy"
                        : systemStatus === "degraded"
                          ? "text-status-degraded"
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
              tone={systemTone}
            />

            <StatCard
              label="Configured Providers"
              value={
                isLoadingProviders ? (
                  "…"
                ) : configuredProviders !== null ? (
                  <AnimatedNumber value={configuredProviders} />
                ) : (
                  "—"
                )
              }
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

      {error && (
        <div className="bg-status-critical-soft px-3 py-2 font-mono text-xs text-status-critical">
          Failed to fetch health data: {error.message}
        </div>
      )}

      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
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
            {microservices.map((name) => {
              const status = data.services[name];
              const variant = toVariant(status);
              return (
                <ServiceCard
                  key={name}
                  name={name}
                  serviceId={name}
                  status={status}
                  onSelect={() =>
                    openServiceSheet({
                      id: name,
                      name,
                      type: "Microservice",
                      healthVariant: variant,
                      healthLabel: status,
                    })
                  }
                />
              );
            })}
          </div>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
          Infrastructure Tools
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {externalServices.map((svc) => {
            const status = data?.services[svc.id];
            const healthVariant = status ? toVariant(status) : null;
            return (
              <ExternalServiceCard
                key={svc.id}
                service={svc}
                healthVariant={healthVariant}
                onSelect={() =>
                  openServiceSheet({
                    id: svc.id,
                    name: svc.label,
                    type: svc.label,
                    healthVariant: healthVariant ?? "unknown",
                    healthLabel: status ?? "unknown",
                    externalUrl: svc.url,
                  })
                }
              />
            );
          })}
        </div>
      </div>

      {providersData && providersData.providers.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80">
            LLM Providers
          </p>
          <div className="flex flex-wrap gap-2">
            {providersData.providers.map((provider) => {
              const hasKey = sqliteKeyIds.has(provider.id);
              const variant: StatusVariant = !provider.requires_key
                ? "unknown"
                : hasKey
                  ? "healthy"
                  : "unknown";

              return (
                <StatusPill key={provider.id} variant={variant}>
                  <span className="font-mono normal-case tracking-normal text-current">
                    {provider.name}
                  </span>
                  {!provider.requires_key
                    ? " · local"
                    : hasKey
                      ? " · ready"
                      : " · no key"}
                </StatusPill>
              );
            })}
          </div>
        </div>
      )}

      <p className="font-mono text-[10px] text-muted-foreground/50">
        Auto-refreshes every 30s &middot; Last updated:{" "}
        <span suppressHydrationWarning>{new Date().toLocaleTimeString()}</span>
      </p>

      <ServiceDetailSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        service={selectedService}
      />
    </PageMount>
  );
}
