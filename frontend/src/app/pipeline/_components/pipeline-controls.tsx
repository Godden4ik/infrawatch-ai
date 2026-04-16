"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { usePipelineStream } from "@/services/pipeline/use-pipeline";
import { ProviderSelector, type ProviderSelection } from "@/components/provider-selector";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Play, Loader2 } from "lucide-react";

export function PipelineControls() {
  const [selection, setSelection] = useState<ProviderSelection>({
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  });

  const mutation = usePipelineStream();

  function handleRun() {
    mutation.mutate({
      llmProvider: selection.provider,
      llmModel: selection.model || undefined,
      apiKey: selection.apiKey ?? undefined,
    });
  }

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-4">
        <CardTitle className="text-base">Pipeline Controls</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ProviderSelector
          value={selection}
          onChange={setSelection}
          label="LLM Provider"
        />

        <Button
          onClick={handleRun}
          disabled={mutation.isPending || !selection.model}
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
