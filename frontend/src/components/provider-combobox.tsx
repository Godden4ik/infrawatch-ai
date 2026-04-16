"use client";

import { useEffect, useState } from "react";
import { getHealthyProviders } from "@/services/providers/actions";
import type { Provider } from "@/services/providers/schema";
import { getProviderDisplay } from "@/lib/provider-display";
import type { ProviderSelection } from "@/components/provider-selector";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ProviderComboboxProps {
  value: ProviderSelection;
  onChange: (value: ProviderSelection) => void;
  label?: string;
}

export function ProviderCombobox({
  value,
  onChange,
  label = "Execution Provider",
}: ProviderComboboxProps) {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void getHealthyProviders()
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          setError(result.error.message);
          setProviders([]);
          return;
        }

        setProviders(result.data.providers);
        setError(null);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Unknown error");
        setProviders([]);
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeProvider = providers.find((provider) => provider.id === value.provider);

  useEffect(() => {
    if (providers.length === 0) {
      return;
    }

    const provider = providers.find((entry) => entry.id === value.provider) ?? providers[0];
    const nextModel =
      provider.models.find((model) => model.id === value.model)?.id ??
      provider.default_model ??
      provider.models[0]?.id ??
      "";

    if (provider.id !== value.provider || nextModel !== value.model) {
      onChange({
        provider: provider.id,
        model: nextModel,
      });
    }
  }, [onChange, providers, value.model, value.provider]);

  function handleProviderChange(providerId: string) {
    const provider = providers.find((entry) => entry.id === providerId);
    if (!provider) return;

    onChange({
      provider: provider.id,
      model: provider.default_model ?? provider.models[0]?.id ?? "",
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 bg-muted/30 px-3 py-3 text-xs text-muted-foreground ring-1 ring-inset ring-border/60">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading healthy providers...
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive/20 bg-destructive/10 px-3 py-3 font-mono text-xs text-destructive">
        {error}
      </div>
    );
  }

  if (providers.length === 0) {
    return (
      <div className="space-y-1 border border-border/70 bg-muted/30 px-3 py-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </p>
        <p className="text-sm text-foreground">No working providers available.</p>
        <p className="text-xs text-muted-foreground">
          Configure provider keys on the Providers page and verify connection health there.
        </p>
      </div>
    );
  }

  const SelectedIcon = activeProvider
    ? getProviderDisplay(activeProvider.id).icon
    : null;
  const selectedDisplay = activeProvider
    ? getProviderDisplay(activeProvider.id)
    : null;

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          {label}
        </label>
        <Select
          value={value.provider}
          onValueChange={(providerId) => {
            if (providerId) {
              handleProviderChange(providerId);
            }
          }}
        >
          <SelectTrigger className="w-full">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              {SelectedIcon ? (
                <SelectedIcon
                  className="h-4 w-4 shrink-0"
                  style={{ color: selectedDisplay?.color }}
                />
              ) : null}
              <SelectValue placeholder="Select provider" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>Healthy Providers</SelectLabel>
              {providers.map((provider) => {
                const display = getProviderDisplay(provider.id);
                const Icon = display.icon;

                return (
                  <SelectItem key={provider.id} value={provider.id}>
                    <div className="flex min-w-0 items-center gap-2">
                      <Icon
                        className="h-4 w-4 shrink-0"
                        style={{ color: display.color }}
                      />
                      <span className="truncate">{provider.name}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      {activeProvider && activeProvider.models.length > 0 ? (
        <div className="space-y-1.5">
          <label className="block text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Model
          </label>
          <Select
            value={value.model}
            onValueChange={(model) => {
              if (!model) return;
              onChange({
                provider: activeProvider.id,
                model,
              });
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>{activeProvider.name} Models</SelectLabel>
                {activeProvider.models.map((model) => (
                  <SelectItem key={model.id} value={model.id}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <span className="font-mono text-sm">{model.name}</span>
                      {model.param_size !== "-" ? (
                        <span className="text-xs text-muted-foreground">
                          {model.param_size}
                        </span>
                      ) : null}
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
