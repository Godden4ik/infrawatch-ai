"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { evaluateRag } from "@/services/rag/actions";
import { ragKeys } from "@/services/rag/query-options";
import { unwrap } from "@/services/_shared/safe-action";
import type { ProviderSelection } from "@/components/provider-selector";
import { ProviderCombobox } from "@/components/provider-combobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { FlaskConical, Loader2, RotateCcw, Sparkles } from "lucide-react";
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

interface EvalVariables {
  query: string;
  serviceContext: string;
  provider: string;
  model?: string;
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
    mutationKey: ragKeys.mutation(),
    mutationFn: async (vars: EvalVariables) => {
      const result = await evaluateRag(
        vars.query,
        vars.serviceContext || undefined,
        vars.provider,
        vars.model,
      );
      return unwrap(result);
    },
    onSuccess: (data, vars) => {
      queryClient.setQueryData(ragKeys.evaluation(vars.query), data);
      onQueryChange(vars.query);
    },
  });

  const submit = () =>
    mutation.mutate({
      query,
      serviceContext,
      provider: judgeSelection.provider,
      model: judgeSelection.model || undefined,
    });

  const retry = () => {
    if (mutation.variables) mutation.mutate(mutation.variables);
  };

  return (
    <Card className="p-0">
      <CardContent className="border-b border-border/60 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-base font-semibold">Query Runner</h2>
            <p className="text-sm text-muted-foreground">
              Evaluate one infrastructure question against both retrieval
              strategies.
            </p>
          </div>
          <div className="bg-primary/10 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-primary ring-1 ring-inset ring-primary/20">
            compare
          </div>
        </div>
      </CardContent>

      <CardContent className="space-y-4 p-4">
        <div className="space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Query
          </label>
          <Textarea
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask an infrastructure question..."
            rows={4}
            className="min-h-[108px] resize-none bg-background/40 font-mono text-sm leading-relaxed"
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Preset Queries
          </label>
          <div className="flex flex-wrap gap-2">
            {PRESET_QUERIES.map((preset) => (
              <button
                key={preset}
                onClick={() => setQuery(preset)}
                className={cn(
                  "border border-border bg-background/40 px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
                  query === preset &&
                    "border-primary/30 bg-primary/10 text-primary",
                )}
              >
                {preset.length > 52 ? `${preset.slice(0, 52)}...` : preset}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        <ProviderCombobox
          value={judgeSelection}
          onChange={setJudgeSelection}
          label="Judge LLM"
        />

        <div className="space-y-2">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Service Context
          </label>
          <Input
            value={serviceContext}
            onChange={(e) => setServiceContext(e.target.value)}
            placeholder="Optional seed context — e.g. redis-cache"
            className="bg-background/40 font-mono"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-border/60 pt-4">
          <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span>One query. Same judge. Two retrieval paths.</span>
          </div>
          <Button
            onClick={submit}
            disabled={mutation.isPending || !query.trim()}
            className="gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Evaluating
              </>
            ) : (
              <>
                <FlaskConical className="h-4 w-4" />
                Compare
              </>
            )}
          </Button>
        </div>

        {mutation.isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center justify-between gap-3 border border-destructive/30 bg-destructive/10 px-3 py-2 font-mono text-xs text-destructive"
          >
            <span className="truncate">{mutation.error.message}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={retry}
              disabled={!mutation.variables || mutation.isPending}
              className="h-7 shrink-0 gap-1.5 border-destructive/40 bg-background/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </Button>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
