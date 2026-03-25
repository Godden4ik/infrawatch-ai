"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { usePipelineStream } from "@/services/pipeline/use-pipeline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const PROVIDERS = [
  { value: "anthropic", label: "Anthropic" },
  { value: "ollama", label: "Ollama" },
] as const;

export function PipelineControls() {
  const [provider, setProvider] = useState("anthropic");
  const [ollamaModel, setOllamaModel] = useState("qwen2.5:14b");
  const mutation = usePipelineStream();

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
            {PROVIDERS.map((p) => (
              <button
                key={p.value}
                onClick={() => setProvider(p.value)}
                className={cn(
                  "relative flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors",
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
                <span className="relative z-10">{p.label}</span>
              </button>
            ))}
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
            <Input
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="qwen2.5:14b"
              className="font-mono text-sm"
            />
          </motion.div>
        )}

        <Button
          onClick={() =>
            mutation.mutate({
              llmProvider: provider,
              llmModel: provider === "ollama" ? ollamaModel : undefined,
            })
          }
          disabled={mutation.isPending}
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
