"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { usePipelineStream } from "@/services/pipeline/use-pipeline";
import { modelQueries } from "@/services/models/query-options";
import { formatSize } from "@/services/models/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Loader2, Server, Cloud, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic", icon: Cloud },
  { value: "ollama", label: "Ollama", icon: Server },
] as const;

export function PipelineControls() {
  const [provider, setProvider] = useState("anthropic");
  const [ollamaModel, setOllamaModel] = useState<string>("");
  const mutation = usePipelineStream();

  const { data: modelsData, isLoading: modelsLoading } = useQuery({
    ...modelQueries.list(),
    enabled: provider === "ollama",
  });

  const models = modelsData?.models ?? [];
  const ollamaAvailable = modelsData?.status === "ok";

  // Auto-select first model when models load
  if (models.length > 0 && !ollamaModel) {
    setOllamaModel(models[0].name);
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Pipeline Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="space-y-2.5">
          <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wider">
            LLM Provider
          </label>
          <div className="bg-secondary/50 flex gap-1 rounded-lg p-1">
            {PROVIDERS.map((p) => {
              const Icon = p.icon;
              return (
                <button
                  key={p.value}
                  onClick={() => setProvider(p.value)}
                  className={cn(
                    "relative flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    provider !== p.value && "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {provider === p.value && (
                    <motion.div
                      layoutId="provider-pill"
                      className="bg-primary/15 border-primary/20 absolute inset-0 rounded-md border"
                      transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
                    />
                  )}
                  <Icon className="relative z-10 h-3.5 w-3.5" />
                  <span className="relative z-10">{p.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {provider === "ollama" && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2.5"
          >
            <label className="text-muted-foreground mb-1.5 block text-xs font-medium uppercase tracking-wider">
              Model
            </label>

            {modelsLoading ? (
              <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Loading models...
              </div>
            ) : !ollamaAvailable ? (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                Ollama unavailable. Is it running?
              </div>
            ) : models.length === 0 ? (
              <div className="flex items-center gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                No models installed. Run <code className="font-mono">ollama pull</code> first.
              </div>
            ) : (
              <Select value={ollamaModel} onValueChange={setOllamaModel}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    <SelectLabel>Available Models</SelectLabel>
                    {models.map((m) => (
                      <SelectItem key={m.name} value={m.name}>
                        <div className="flex w-full items-center justify-between gap-3">
                          <span className="font-mono text-sm">{m.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {m.parameter_size || formatSize(m.size)}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          </motion.div>
        )}

        <Button
          onClick={() =>
            mutation.mutate({
              llmProvider: provider,
              llmModel: provider === "ollama" ? ollamaModel : undefined,
            })
          }
          disabled={mutation.isPending || (provider === "ollama" && !ollamaModel)}
          className="w-full gap-2 py-5 text-sm font-medium"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Running...
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Run Pipeline
            </>
          )}
        </Button>

        {mutation.isError && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-destructive text-sm"
          >
            {mutation.error.message}
          </motion.p>
        )}
      </CardContent>
    </Card>
  );
}
