"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, KeyRound, Loader2, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  providerQueries,
  providerKeys,
} from "@/services/providers/query-options";
import { getProviderDisplay } from "@/lib/provider-display";
import { getStoredKey, storeKey, clearKey } from "@/lib/provider-keys";
import { saveKey, removeKey } from "@/services/providers/actions";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/services/_shared/fetch-client";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { HealthResponse } from "@/services/providers/schema";

export type ProviderSelection = {
  provider: string;
  model: string;
  apiKey?: string | null;
};

interface ProviderSelectorProps {
  value: ProviderSelection;
  onChange: (value: ProviderSelection) => void;
  label?: string;
}

export function ProviderSelector({
  value,
  onChange,
  label = "LLM Provider",
}: ProviderSelectorProps) {
  const queryClient = useQueryClient();
  const [keyInput, setKeyInput] = useState("");
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  const { data: providersData, isLoading: providersLoading } = useQuery(
    providerQueries.list(),
  );

  const providers = providersData?.providers ?? [];
  const activeProvider = providers.find((p) => p.id === value.provider);

  const [storedKey, setStoredKey] = useState<string | null>(null);
  useEffect(() => {
    setStoredKey(getStoredKey(value.provider));
    setKeyInput("");
  }, [value.provider]);

  // Auto-pick default model when provider changes
  useEffect(() => {
    if (!activeProvider) return;
    const modelIds = activeProvider.models.map((m) => m.id);
    if (
      !value.model ||
      (modelIds.length > 0 && !modelIds.includes(value.model))
    ) {
      onChange({
        ...value,
        model:
          activeProvider.default_model || activeProvider.models[0]?.id || "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProvider?.id, value.provider]);

  async function runHealthCheck(providerId: string, key?: string | null) {
    setIsCheckingHealth(true);
    try {
      const headers: Record<string, string> = {};
      const resolvedKey = key ?? storedKey;
      if (resolvedKey) headers["X-Provider-Key"] = resolvedKey;

      const health = await apiClient<HealthResponse>(
        `/api/providers/${providerId}/health`,
        { headers },
      );
      queryClient.setQueryData(providerKeys.health(providerId), health);

      if (health.status === "healthy") {
        toast.success(`${providerId} is healthy (${health.latency_ms}ms)`);
      } else if (health.status !== "no_key") {
        toast.error(
          `${providerId} health check failed: ${health.error ?? health.status}`,
        );
      }
    } catch (err) {
      toast.error(
        `Health check failed: ${err instanceof Error ? err.message : "Unknown error"}`,
      );
    } finally {
      setIsCheckingHealth(false);
    }
  }

  function handleProviderSelect(providerId: string) {
    const p = providers.find((p) => p.id === providerId);
    const key = getStoredKey(providerId);
    setStoredKey(key);
    onChange({
      provider: providerId,
      model: p?.default_model ?? p?.models[0]?.id ?? "",
      apiKey: key,
    });
  }

  function handleSaveKey() {
    if (!keyInput.trim()) return;
    const trimmed = keyInput.trim();
    // sessionStorage for immediate UX (cache)
    storeKey(value.provider, trimmed);
    setStoredKey(trimmed);
    onChange({ ...value, apiKey: trimmed });
    setKeyInput("");
    toast.success("API key saved");
    // Persist to SQLite via server action (fire-and-forget)
    saveKey(value.provider, trimmed).catch(console.error);
    runHealthCheck(value.provider, trimmed);
  }

  function handleClearKey() {
    // Clear sessionStorage cache
    clearKey(value.provider);
    setStoredKey(null);
    onChange({ ...value, apiKey: null });
    toast.info("API key cleared");
    // Remove from SQLite via server action (fire-and-forget)
    removeKey(value.provider).catch(console.error);
  }

  const needsKey =
    !!activeProvider?.requires_key && !activeProvider?.available && !storedKey;
  const hasModels = activeProvider && activeProvider.models.length > 0;
  const activeModel = activeProvider?.models.find((model) => model.id === value.model);

  return (
    <div className="space-y-3">
      {/* Label */}
      <label className="text-muted-foreground block text-xs font-medium uppercase tracking-wider">
        {label}
      </label>

      {/* Provider pills — fixed 2x2 grid, no wrapping shift */}
      {providersLoading ? (
        <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Loading providers...
        </div>
      ) : (
        <div className="bg-secondary/50 grid grid-cols-2 gap-1 rounded-lg p-1">
          {providers.map((p) => {
            const display = getProviderDisplay(p.id);
            const Icon = display.icon;
            const isActive = value.provider === p.id;
            const cachedHealth = queryClient.getQueryData<HealthResponse>(
              providerKeys.health(p.id),
            );

            return (
              <button
                key={p.id}
                onClick={() => handleProviderSelect(p.id)}
                className={cn(
                  "relative flex items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  !isActive && "text-muted-foreground hover:text-foreground",
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId={`provider-pill-${label}`}
                    className="bg-primary/15 border-primary/20 absolute inset-0 rounded-md border"
                    transition={{
                      type: "spring",
                      bounce: 0.15,
                      duration: 0.4,
                    }}
                  />
                )}
                <Icon
                  className="relative z-10 h-3.5 w-3.5 shrink-0"
                  style={{ color: display.color }}
                />
                <span className="relative z-10">{p.name}</span>
                {p.requires_key && p.available && (
                  <Lock className="relative z-10 h-3 w-3 shrink-0 text-muted-foreground" />
                )}
                {cachedHealth?.status === "healthy" && (
                  <span className="relative z-10 h-1.5 w-1.5 shrink-0 rounded-full bg-status-healthy" />
                )}
                {cachedHealth &&
                  cachedHealth.status !== "healthy" &&
                  cachedHealth.status !== "no_key" && (
                    <span className="relative z-10 h-1.5 w-1.5 shrink-0 rounded-full bg-status-critical" />
                  )}
                {isCheckingHealth && isActive && (
                  <Loader2 className="relative z-10 h-3 w-3 shrink-0 animate-spin" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Model dropdown — always rendered, no height animation */}
      {hasModels && (
        <div className="space-y-1.5">
          <label className="text-muted-foreground block text-xs font-medium uppercase tracking-wider">
            Model
          </label>
          <Select
            value={value.model}
            onValueChange={(m) => m && onChange({ ...value, model: m })}
          >
            <SelectTrigger className="w-full">
              <span className="truncate">
                {activeModel?.name ?? "Select a model"}
              </span>
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{activeProvider!.name} Models</SelectLabel>
                {activeProvider!.models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="font-mono text-sm">{m.name}</span>
                      {m.param_size !== "-" && (
                        <span className="text-xs text-muted-foreground">
                          {m.param_size}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      )}

      {/* API key section — fixed height slot, content fades in/out */}
      {activeProvider?.requires_key && !activeProvider?.available && (
        <div className="space-y-1.5">
          {needsKey ? (
            <>
              <label className="text-muted-foreground block text-xs font-medium uppercase tracking-wider">
                API Key
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <KeyRound className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2" />
                  <Input
                    type="password"
                    value={keyInput}
                    onChange={(e) => setKeyInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSaveKey()}
                    placeholder="Paste your API key…"
                    className="pl-9"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveKey}
                  disabled={!keyInput.trim()}
                  className="gap-1.5"
                >
                  <Check className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </>
          ) : (
            <div className="bg-secondary/60 flex items-center justify-between rounded-lg px-3 py-2 text-xs">
              <div className="flex items-center gap-2 text-muted-foreground">
                <KeyRound className="h-3 w-3 text-status-healthy" />
                <span>Session key active</span>
              </div>
              <button
                onClick={handleClearKey}
                className="text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
              >
                <X className="h-3 w-3" />
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
