"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { evaluateRag } from "@/services/rag/actions";
import { ragKeys } from "@/services/rag/query-options";
import { unwrap } from "@/services/_shared/safe-action";
import { ProviderSelector, type ProviderSelection } from "@/components/provider-selector";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FlaskConical, Loader2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const PRESET_QUERIES = [
  "What services are affected when redis-cache goes down?",
  "How do I fix high latency in payment-service?",
  "What happened during the last order-service outage?",
  "Which runbooks apply to api-gateway errors?",
];

interface EvalFormProps {
  onQueryChange: (query: string) => void;
}

export function EvalForm({ onQueryChange }: EvalFormProps) {
  const [query, setQuery] = useState("");
  const [serviceContext, setServiceContext] = useState("");
  const [judgeSelection, setJudgeSelection] = useState<ProviderSelection>({
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  });
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const result = await evaluateRag(
        query,
        serviceContext || undefined,
        judgeSelection.provider,
        judgeSelection.model || undefined,
        judgeSelection.apiKey ?? undefined,
      );
      return unwrap(result);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(ragKeys.evaluation(query), data);
      onQueryChange(query);
    },
  });

  return (
    <div className="space-y-6">
      {/* Query input — big and prominent */}
      <div className="space-y-3">
        <label className="text-muted-foreground text-xs font-medium uppercase tracking-widest">
          Query
        </label>
        <div className="relative">
          <textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask an infrastructure question..."
            rows={3}
            className={cn(
              "bg-secondary/40 border-border/50 text-foreground placeholder:text-muted-foreground/40",
              "w-full rounded-xl border px-5 py-4 text-base leading-relaxed",
              "focus:border-primary/50 focus:ring-primary/20 focus:outline-none focus:ring-2",
              "resize-none transition-all",
            )}
          />
        </div>
      </div>

      {/* Preset queries */}
      <div className="flex flex-wrap gap-2">
        {PRESET_QUERIES.map((preset) => (
          <button
            key={preset}
            onClick={() => setQuery(preset)}
            className={cn(
              "bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground",
              "rounded-lg px-3.5 py-2 text-sm transition-all",
              query === preset && "bg-primary/10 text-primary border-primary/20 border",
            )}
          >
            {preset.length > 45 ? preset.slice(0, 45) + "..." : preset}
          </button>
        ))}
      </div>

      {/* Judge LLM selector */}
      <ProviderSelector
        value={judgeSelection}
        onChange={setJudgeSelection}
        label="Judge LLM"
      />

      {/* Service context + submit */}
      <div className="flex gap-3">
        <div className="flex-1">
          <Input
            value={serviceContext}
            onChange={(e) => setServiceContext(e.target.value)}
            placeholder="Service context (optional) — e.g. redis-cache"
            className="bg-secondary/40 h-12 rounded-xl px-4 text-sm"
          />
        </div>
        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || !query.trim()}
          className="h-12 gap-2.5 rounded-xl px-8 text-base font-medium"
          size="lg"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Evaluating
            </>
          ) : (
            <>
              <FlaskConical className="h-5 w-5" />
              Compare
            </>
          )}
        </Button>
      </div>

      {mutation.isError && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-destructive/10 text-destructive rounded-lg px-4 py-3 text-sm"
        >
          {mutation.error.message}
        </motion.div>
      )}
    </div>
  );
}
