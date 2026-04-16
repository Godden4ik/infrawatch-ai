"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveKey,
  removeKey,
  checkProviderHealth,
  getMasked,
} from "@/services/providers/actions";
import { providerKeys } from "@/services/providers/query-options";
import { unwrap } from "@/services/_shared/safe-action";
import { getProviderDisplay } from "@/lib/provider-display";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import type { Provider, HealthResponse } from "@/services/providers/schema";

// ─── Status badge ─────────────────────────────────────────────────────────────

type ConfigStatus = "env-key" | "sqlite-key" | "no-key";

function StatusBadge({ status }: { status: ConfigStatus }) {
  if (status === "env-key") {
    return (
      <Badge className="bg-blue-500/10 text-blue-400 border-transparent text-[10px] font-medium uppercase tracking-wider">
        Env Key
      </Badge>
    );
  }
  if (status === "sqlite-key") {
    return (
      <Badge className="bg-emerald-500/10 text-emerald-400 border-transparent text-[10px] font-medium uppercase tracking-wider">
        Configured
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] font-medium uppercase tracking-wider">
      No Key
    </Badge>
  );
}

// ─── Health result inline display ─────────────────────────────────────────────

function HealthResult({
  result,
  isLoading,
}: {
  result: HealthResponse | null;
  isLoading: boolean;
}) {
  if (isLoading) {
    return <Skeleton className="h-3 w-24 inline-block" />;
  }
  if (!result) return null;

  if (result.status === "healthy") {
    return (
      <span className="font-mono text-[10px] text-emerald-500">
        {result.latency_ms}ms
      </span>
    );
  }
  if (result.status === "no_key") {
    return (
      <span className="font-mono text-[10px] text-amber-500">no key set</span>
    );
  }
  return (
    <span className="font-mono text-[10px] text-destructive">
      {result.error ?? "unhealthy"}
    </span>
  );
}

// ─── Provider card ────────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: Provider;
  /** Whether a SQLite-stored key exists for this provider */
  hasSqliteKey: boolean;
}

export function ProviderCard({ provider, hasSqliteKey }: ProviderCardProps) {
  const queryClient = useQueryClient();
  const display = getProviderDisplay(provider.id);
  const Icon = display.icon;

  // Determine config status
  const configStatus: ConfigStatus = hasSqliteKey
    ? "sqlite-key"
    : provider.available && provider.requires_key
      ? "env-key"
      : !provider.requires_key || provider.available
        ? "env-key"
        : "no-key";

  const isConfigured = hasSqliteKey || provider.available;

  // Local state
  const [keyInput, setKeyInput] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null | undefined>(
    undefined,
  );
  const [healthResult, setHealthResult] = useState<HealthResponse | null>(null);
  const [modelsExpanded, setModelsExpanded] = useState(false);

  // Load masked key when the card mounts (if sqlite key exists)
  // We do it lazily on first render via an effect-free approach:
  // we rely on the parent to pass hasSqliteKey, and fetch masked on demand

  // ── Save key mutation ──────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: async () => {
      const result = await saveKey(provider.id, keyInput.trim());
      return unwrap(result);
    },
    onSuccess: async () => {
      setKeyInput("");
      toast.success(`API key saved for ${provider.name}`);
      // Fetch the masked key to display
      const maskedResult = await getMasked(provider.id);
      const maskedData = unwrap(maskedResult);
      setMaskedKey(maskedData.masked);
      queryClient.invalidateQueries({ queryKey: providerKeys.list() });
    },
    onError: (err) => {
      toast.error(`Failed to save key: ${err.message}`);
    },
  });

  // ── Remove key mutation ────────────────────────────────────────────────────
  const removeMutation = useMutation({
    mutationFn: async () => {
      const result = await removeKey(provider.id);
      return unwrap(result);
    },
    onSuccess: () => {
      setMaskedKey(null);
      setHealthResult(null);
      toast.success(`API key removed for ${provider.name}`);
      queryClient.invalidateQueries({ queryKey: providerKeys.list() });
    },
    onError: (err) => {
      toast.error(`Failed to remove key: ${err.message}`);
    },
  });

  // ── Health check mutation ──────────────────────────────────────────────────
  const healthMutation = useMutation({
    mutationFn: async () => {
      const result = await checkProviderHealth(provider.id);
      return unwrap(result);
    },
    onSuccess: (data) => {
      setHealthResult(data);
      if (data.status === "healthy") {
        toast.success(`${provider.name} is healthy (${data.latency_ms}ms)`);
      } else if (data.status === "no_key") {
        toast.info(`${provider.name}: no API key configured`);
      } else {
        toast.error(`${provider.name}: ${data.error ?? "unhealthy"}`);
      }
    },
    onError: (err) => {
      toast.error(`Health check failed: ${err.message}`);
    },
  });

  // Fetch masked key when we know a sqlite key exists and haven't fetched yet
  const handleShowMasked = async () => {
    if (maskedKey === undefined && hasSqliteKey) {
      try {
        const result = await getMasked(provider.id);
        const data = unwrap(result);
        setMaskedKey(data.masked);
      } catch {
        setMaskedKey(null);
      }
    }
  };

  // Trigger masked key fetch on first render if sqlite key exists
  // Using a ref to avoid double-fetching in strict mode
  const [fetchedMasked, setFetchedMasked] = useState(false);
  if (hasSqliteKey && !fetchedMasked) {
    setFetchedMasked(true);
    handleShowMasked();
  }

  const showModels = provider.models.length <= 5 || modelsExpanded;
  const hiddenCount = provider.models.length - 5;

  const isMutating =
    saveMutation.isPending ||
    removeMutation.isPending ||
    healthMutation.isPending;

  return (
    <Card className="p-0 flex flex-col">
      {/* ── Card header ───────────────────────────────────────────────── */}
      <CardContent className="p-4 border-b border-border/50">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="flex h-7 w-7 shrink-0 items-center justify-center"
              style={{ color: display.color }}
            >
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold leading-none">{provider.name}</p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {display.description}
              </p>
            </div>
          </div>
          <StatusBadge status={configStatus} />
        </div>
      </CardContent>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      <CardContent className="flex flex-col gap-4 p-4">
        {/* API KEY section */}
        {provider.requires_key && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              API Key
            </p>

            {isConfigured ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-xs text-muted-foreground bg-muted/40 px-2 py-1 min-w-0 truncate">
                  {hasSqliteKey
                    ? maskedKey === undefined
                      ? "loading..."
                      : (maskedKey ?? "sk-...????")
                    : "Environment variable"}
                </code>
                {hasSqliteKey && (
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate()}
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Remove"
                    )}
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isMutating}
                  onClick={() => healthMutation.mutate()}
                >
                  {healthMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    "Test"
                  )}
                </Button>
                {(healthMutation.isSuccess || healthMutation.isError) && (
                  <HealthResult
                    result={healthResult}
                    isLoading={healthMutation.isPending}
                  />
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && keyInput.trim()) {
                        saveMutation.mutate();
                      }
                    }}
                    className="flex-1"
                    disabled={saveMutation.isPending}
                  />
                  <Button
                    size="sm"
                    disabled={saveMutation.isPending || !keyInput.trim()}
                    onClick={() => saveMutation.mutate()}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isMutating}
                    onClick={() => healthMutation.mutate()}
                  >
                    Test
                  </Button>
                </div>
                {(healthMutation.isSuccess || healthMutation.isError) && (
                  <HealthResult
                    result={healthResult}
                    isLoading={healthMutation.isPending}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* No key required (e.g. Ollama) — just show test button */}
        {!provider.requires_key && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Connection
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={healthMutation.isPending}
                onClick={() => healthMutation.mutate()}
              >
                {healthMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  "Test Connection"
                )}
              </Button>
              {(healthMutation.isSuccess || healthMutation.isError) && (
                <HealthResult
                  result={healthResult}
                  isLoading={healthMutation.isPending}
                />
              )}
            </div>
          </div>
        )}

        {/* DEFAULT MODEL */}
        <div className="space-y-1">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Default Model
          </p>
          <p className="font-mono text-xs text-foreground">{provider.default_model}</p>
        </div>

        {/* MODELS list */}
        {provider.models.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Models ({provider.models.length})
            </p>
            <ul className="space-y-0.5">
              {(showModels ? provider.models : provider.models.slice(0, 5)).map(
                (model) => (
                  <li
                    key={model.id}
                    className="flex items-center gap-2 min-w-0"
                  >
                    <span className="font-mono text-xs text-muted-foreground truncate">
                      {model.id}
                    </span>
                    {model.param_size && model.param_size !== "-" && (
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">
                        {model.param_size}
                      </span>
                    )}
                  </li>
                ),
              )}
            </ul>
            {provider.models.length > 5 && (
              <button
                className="flex items-center gap-1 font-mono text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                onClick={() => setModelsExpanded((v) => !v)}
              >
                {modelsExpanded ? (
                  <>
                    <ChevronUp className="h-3 w-3" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    {hiddenCount} more
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
