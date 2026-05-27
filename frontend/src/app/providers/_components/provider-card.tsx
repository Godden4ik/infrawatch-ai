"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  saveKey,
  removeKey,
  checkProviderHealth,
  getMasked,
  getRevealed,
} from "@/services/providers/actions";
import { providerKeys } from "@/services/providers/query-options";
import { unwrap } from "@/services/_shared/safe-action";
import { getProviderDisplay } from "@/lib/provider-display";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusDot, StatusPill } from "@/components/ui/status-indicator";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Skeleton } from "@/components/ui/skeleton";
import { KeySpoiler } from "@/components/ui/key-spoiler";
import { WifiIcon, type WifiIconHandle } from "@/components/ui/wifi-icon";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2 } from "lucide-react";
import type { Provider, HealthResponse } from "@/services/providers/schema";

function getConnectionFailureMessage(error: string | undefined) {
  const message = error?.toLowerCase() ?? "";

  if (
    message.includes("api_key_invalid") ||
    message.includes("invalid api key") ||
    message.includes("api key not valid") ||
    message.includes("incorrect api key") ||
    message.includes("invalid_argument")
  ) {
    return "Invalid API key";
  }

  return "No connection";
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ configured, requiresKey }: { configured: boolean; requiresKey: boolean }) {
  if (configured) {
    return <StatusPill variant="healthy">Configured</StatusPill>;
  }
  if (!requiresKey) {
    return (
      <Badge className="border-transparent bg-brand-soft text-brand text-[10px] font-medium uppercase tracking-wider">
        Local
      </Badge>
    );
  }
  return <StatusPill variant="degraded">No Key</StatusPill>;
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
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <StatusDot variant="healthy" />
        <span className="text-foreground">{result.latency_ms}ms</span>
      </span>
    );
  }
  if (result.status === "no_key") {
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
        <StatusDot variant="degraded" />
        no key set
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
      <StatusDot variant="critical" />
      {getConnectionFailureMessage(result.error)}
    </span>
  );
}

function ConnectionTestButton({
  providerId,
  isPending,
  state,
  onClick,
}: {
  providerId: string;
  isPending: boolean;
  state: "idle" | "success" | "error";
  onClick: () => void;
}) {
  const wifiRef = useRef<WifiIconHandle>(null);

  useEffect(() => {
    if (isPending) {
      void wifiRef.current?.startAnimation();
      return;
    }

    wifiRef.current?.stopAnimation();
  }, [isPending]);

  return (
    <Button
      variant="outline"
      size="default"
      disabled={isPending}
      onClick={onClick}
    >
      <span
        data-testid={`connection-indicator-${providerId}`}
        className={cn(
          "inline-flex items-center justify-center text-muted-foreground transition-colors",
          state === "success" && "text-status-healthy",
          state === "error" && "text-destructive",
        )}
      >
        <WifiIcon ref={wifiRef} size={14} />
      </span>
      <span>{isPending ? "Testing..." : "Test Connection"}</span>
    </Button>
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
  const healthResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  // Local state
  const [hasStoredKey, setHasStoredKey] = useState(hasSqliteKey);
  const [keyInput, setKeyInput] = useState("");
  const [maskedKey, setMaskedKey] = useState<string | null | undefined>(
    undefined,
  );
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [keyRevealed, setKeyRevealed] = useState(false);
  const [isRevealLoading, setIsRevealLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [healthResult, setHealthResult] = useState<HealthResponse | null>(null);
  const [connectionState, setConnectionState] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [modelsExpanded, setModelsExpanded] = useState(false);
  const [baseUrlInput, setBaseUrlInput] = useState("");

  const isConfigured = hasStoredKey;

  useEffect(() => {
    setHasStoredKey(hasSqliteKey);
  }, [hasSqliteKey]);

  useEffect(() => {
    return () => {
      if (healthResetTimeoutRef.current) {
        clearTimeout(healthResetTimeoutRef.current);
      }
    };
  }, []);

  function flashConnectionState(state: "success" | "error") {
    if (healthResetTimeoutRef.current) {
      clearTimeout(healthResetTimeoutRef.current);
    }

    setConnectionState(state);
    healthResetTimeoutRef.current = setTimeout(() => {
      setConnectionState("idle");
      healthResetTimeoutRef.current = null;
    }, 2000);
  }

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
      setHasStoredKey(true);
      setKeyInput("");
      setIsEditing(false);
      setKeyRevealed(false);
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
      setHasStoredKey(false);
      setMaskedKey(null);
      setRevealedKey(null);
      setHealthResult(null);
      setIsEditing(false);
      setKeyRevealed(false);
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
        flashConnectionState("success");
        toast.success(`${provider.name} is healthy (${data.latency_ms}ms)`);
      } else if (data.status === "no_key") {
        flashConnectionState("error");
        toast.info(`${provider.name}: no API key configured`);
      } else {
        flashConnectionState("error");
        toast.error(`${provider.name}: ${getConnectionFailureMessage(data.error)}`);
      }
    },
    onError: (err) => {
      flashConnectionState("error");
      toast.error(`Health check failed: ${getConnectionFailureMessage(err.message)}`);
    },
  });

  useEffect(() => {
    let cancelled = false;

    if (!hasStoredKey || maskedKey !== undefined) {
      return;
    }

    void getMasked(provider.id)
      .then(unwrap)
      .then((data) => {
        if (!cancelled) {
          setMaskedKey(data.masked);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMaskedKey(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [hasStoredKey, maskedKey, provider.id]);

  const showModels = provider.models.length <= 5 || modelsExpanded;
  const hiddenCount = provider.models.length - 5;

  const isMutating =
    saveMutation.isPending ||
    removeMutation.isPending ||
    healthMutation.isPending;

  async function toggleKeyReveal() {
    if (!hasStoredKey || isRevealLoading) {
      return;
    }

    if (keyRevealed) {
      setKeyRevealed(false);
      setRevealedKey(null);
      return;
    }

    setIsRevealLoading(true);

    try {
      const revealedResult = await getRevealed(provider.id);
      const revealedData = unwrap(revealedResult);

      if (!revealedData.key) {
        throw new Error("Provider key not found");
      }

      setRevealedKey(revealedData.key);
      setKeyRevealed(true);
    } catch (err) {
      toast.error(
        `Failed to reveal key: ${err instanceof Error ? err.message : "unknown error"}`,
      );
    } finally {
      setIsRevealLoading(false);
    }
  }

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
          <StatusBadge configured={isConfigured} requiresKey={provider.requires_key} />
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

            {isConfigured && !isEditing ? (
              /* ── Read mode: full-width spoiler + buttons row ── */
              <div className="space-y-2">
                <InputGroup
                  className="w-full cursor-pointer"
                  onClick={() => void toggleKeyReveal()}
                >
                  <span className="flex flex-1 items-center px-2.5 min-w-0 overflow-hidden">
                    {maskedKey === undefined ? (
                      <span className="font-mono text-xs text-muted-foreground">loading...</span>
                    ) : (
                      <KeySpoiler
                        className="w-full"
                        revealed={keyRevealed}
                        onReveal={() => void toggleKeyReveal()}
                      >
                        {keyRevealed
                          ? (revealedKey ?? maskedKey ?? "sk-...????")
                          : (maskedKey ?? "sk-...????")}
                      </KeySpoiler>
                    )}
                  </span>
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      onClick={(e) => {
                        e.stopPropagation();
                        void toggleKeyReveal();
                      }}
                      aria-label={keyRevealed ? "Hide key" : "Reveal key"}
                    >
                      {isRevealLoading ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : keyRevealed ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="default"
                    disabled={isMutating}
                    onClick={() => {
                      setIsEditing(true);
                      setKeyRevealed(false);
                      setRevealedKey(null);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="secondary"
                    size="default"
                    disabled={removeMutation.isPending}
                    onClick={() => removeMutation.mutate()}
                  >
                    {removeMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Remove"
                    )}
                  </Button>
                  <ConnectionTestButton
                    providerId={provider.id}
                    isPending={healthMutation.isPending}
                    state={connectionState}
                    onClick={() => healthMutation.mutate()}
                  />
                  {(healthMutation.isSuccess || healthMutation.isError) && (
                    <HealthResult
                      result={healthResult}
                      isLoading={healthMutation.isPending}
                    />
                  )}
                </div>
              </div>
            ) : (
              /* ── Input mode: full-width input + buttons row ── */
              <div className="space-y-2">
                <InputGroup className="w-full">
                  <InputGroupInput
                    type={keyRevealed ? "text" : "password"}
                    placeholder="sk-..."
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && keyInput.trim()) {
                        saveMutation.mutate();
                      }
                    }}
                    disabled={saveMutation.isPending}
                    autoFocus={isEditing}
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      onClick={() => setKeyRevealed((v) => !v)}
                      aria-label={keyRevealed ? "Hide input" : "Show input"}
                    >
                      {keyRevealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                <div className="flex items-center gap-2">
                  <Button
                    size="default"
                    disabled={saveMutation.isPending || !keyInput.trim()}
                    onClick={() => saveMutation.mutate()}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      "Save"
                    )}
                  </Button>
                  {isEditing && (
                    <Button
                      variant="ghost"
                      size="default"
                      disabled={saveMutation.isPending}
                      onClick={() => { setIsEditing(false); setKeyInput(""); setKeyRevealed(false); }}
                    >
                      Cancel
                    </Button>
                  )}
                  {!isEditing && (
                    <ConnectionTestButton
                      providerId={provider.id}
                      isPending={healthMutation.isPending}
                      state={connectionState}
                      onClick={() => healthMutation.mutate()}
                    />
                  )}
                  {(healthMutation.isSuccess || healthMutation.isError) && (
                    <HealthResult
                      result={healthResult}
                      isLoading={healthMutation.isPending}
                    />
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* No key required (e.g. Ollama) — base URL input + test */}
        {!provider.requires_key && (
          <div className="space-y-2">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Base URL
            </p>
            <InputGroup className="w-full">
              <InputGroupInput
                type="text"
                placeholder="http://localhost:11434"
                value={baseUrlInput}
                onChange={(e) => setBaseUrlInput(e.target.value)}
              />
            </InputGroup>
            <div className="flex items-center gap-2">
              <ConnectionTestButton
                providerId={provider.id}
                isPending={healthMutation.isPending}
                state={connectionState}
                onClick={() => healthMutation.mutate()}
              />
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
