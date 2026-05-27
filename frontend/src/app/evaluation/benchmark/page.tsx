"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { providerQueries } from "@/services/providers/query-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { PageMount } from "@/components/layout/page-mount";
import { ProviderCombobox } from "@/components/provider-combobox";
import type { ProviderSelection } from "@/components/provider-selector";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Play, 
  Terminal, 
  CheckCircle2, 
  XCircle, 
  Loader2, 
  BarChart3,
  AlertCircle
} from "lucide-react";
import type { BenchmarkResult, BenchmarkEvent } from "@/services/evaluation/schema";
import { cn } from "@/lib/utils";

export default function BenchmarkPage() {
  const [selection, setSelection] = useState<ProviderSelection>({
    provider: "anthropic",
    model: "claude-haiku-4-5-20251001",
  });
  const [apiKey, setApiKey] = useState<string>("");
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<BenchmarkResult[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: providersData } = useQuery(providerQueries.list());
  const selectedProvider = providersData?.providers.find((p) => p.id === selection.provider);

  const logEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs]);

  const runBenchmark = async () => {
    setIsRunning(true);
    setLogs([]);
    setResults(null);
    setError(null);

    try {
      const response = await fetch("/api/evaluation/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          llm_provider: selection.provider,
          llm_model: selection.model || undefined,
          api_key: apiKey || undefined,
        }),
      });

      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      if (!response.body) throw new Error("No response body");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6)) as BenchmarkEvent;
              if (event.type === "log") {
                setLogs((prev) => [...prev, event.message]);
              } else if (event.type === "complete") {
                setResults(event.results);
                setIsRunning(false);
              } else if (event.type === "error") {
                setError(event.message);
                setIsRunning(false);
              }
            } catch (e) {
              console.error("Error parsing SSE line:", e);
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error occurred");
      setIsRunning(false);
    }
  };

  const summary = results
    ? (() => {
        const items = results.length;
        const rcaAcc =
          results.filter((r) => r.rca_correct).length / items;
        const avgPrecision =
          results.reduce((a, r) => a + r.blast_radius_precision, 0) / items;
        const avgRecall =
          results.reduce((a, r) => a + r.blast_radius_recall, 0) / items;
        const f1 =
          avgPrecision + avgRecall > 0
            ? (2 * avgPrecision * avgRecall) / (avgPrecision + avgRecall)
            : 0;
        const avgRunbookRecall =
          results.reduce((a, r) => a + r.runbook_recall, 0) / items;
        const avgDuration =
          results.reduce((a, r) => a + r.duration, 0) / items;
        return {
          items,
          rcaAcc,
          avgPrecision,
          avgRecall,
          f1,
          avgRunbookRecall,
          avgDuration,
        };
      })()
    : null;

  return (
    <PageMount className="mx-auto max-w-6xl space-y-4">
      <PageHeader
        title="Accuracy Benchmark"
        description="Run the agent pipeline against a gold dataset to measure precision and recall"
      />

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        {/* Controls */}
        <div className="space-y-4">
          <Card className="p-0">
            <CardHeader className="border-b border-border/60 px-4 pb-3 pt-4">
              <CardTitle className="text-sm font-medium">Pipeline Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-4">
              <ProviderCombobox
                value={selection}
                onChange={setSelection}
                label="Execution Provider"
              />

              {selectedProvider?.requires_key && (
                <div className="space-y-2">
                  <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    API Key (Optional)
                  </label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="h-9 bg-background/40 font-mono"
                  />
                  <p className="font-mono text-[10px] text-muted-foreground">
                    Overrides .env if provided
                  </p>
                </div>
              )}

              <Button
                className="w-full"
                onClick={runBenchmark}
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Start Benchmark
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {error && (
            <div className="flex items-center gap-2 border border-status-critical/30 bg-status-critical-soft p-3 text-status-critical">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <p className="font-mono text-xs">{error}</p>
            </div>
          )}
        </div>

        {/* Execution Logs */}
        <div className="space-y-4">
          <Card className="p-0">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/60 px-4 pb-3 pt-4">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Terminal className="h-4 w-4 text-brand" />
                Live Console
              </CardTitle>
              {isRunning && (
                <span className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-brand">
                  <span className="h-1.5 w-1.5 animate-pulse bg-brand" />
                  streaming
                </span>
              )}
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[400px] w-full border-t border-border/60 bg-card/60 p-4">
                <div className="space-y-1 font-mono text-[12px] leading-relaxed">
                  {logs.length === 0 && !isRunning && (
                    <p className="text-muted-foreground">
                      <span className="text-brand">$</span> awaiting benchmark…
                    </p>
                  )}
                  {logs.map((log, i) => {
                    const isError = log.includes("[ERROR]");
                    const isPass = log.includes("✅ PASS") || log.includes("PASS");
                    const isFail = log.includes("❌ FAIL") || log.includes("FAIL");
                    const isComplete =
                      log.toLowerCase().includes("complete") ||
                      log.toLowerCase().includes("finished");
                    return (
                      <div
                        key={i}
                        className={cn(
                          "whitespace-pre-wrap",
                          isError
                            ? "text-status-critical"
                            : isPass
                            ? "text-status-healthy"
                            : isFail
                            ? "text-status-degraded"
                            : isComplete
                            ? "text-status-healthy"
                            : "text-muted-foreground",
                        )}
                      >
                        {isError && (
                          <AlertCircle className="mr-1.5 inline h-3 w-3 -translate-y-px text-status-critical" />
                        )}
                        {log}
                      </div>
                    );
                  })}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <AnimatePresence>
            {results && summary && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-3"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-brand" />
                  <h2 className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
                    Results Summary
                  </h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <SummaryStat
                    label="Precision"
                    value={`${(summary.avgPrecision * 100).toFixed(0)}%`}
                    sub="blast radius • avg"
                  />
                  <SummaryStat
                    label="Recall"
                    value={`${(summary.avgRecall * 100).toFixed(0)}%`}
                    sub="blast radius • avg"
                  />
                  <SummaryStat
                    label="F1 Score"
                    value={summary.f1.toFixed(2)}
                    sub="precision · recall"
                  />
                  <SummaryStat
                    label="Items Evaluated"
                    value={summary.items.toString()}
                    sub={`${(summary.rcaAcc * 100).toFixed(0)}% RCA correct`}
                  />
                </div>

                <Card className="p-0">
                  <div className="overflow-hidden">
                    <table className="w-full text-left text-[12px]">
                      <thead className="border-b border-border/60 font-mono uppercase tracking-[0.14em] text-muted-foreground">
                        <tr>
                          <th className="px-4 py-2 text-[10px]">ID</th>
                          <th className="px-4 py-2 text-[10px]">Scenario</th>
                          <th className="px-4 py-2 text-center text-[10px]">RCA</th>
                          <th className="px-4 py-2 text-center text-[10px]">BR Recall</th>
                          <th className="px-4 py-2 text-center text-[10px]">RB Recall</th>
                          <th className="px-4 py-2 text-right text-[10px]">Time</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40 font-mono">
                        {results.map((r) => (
                          <tr key={r.id} className="hover:bg-muted/20">
                            <td className="px-4 py-2 text-muted-foreground">{r.id}</td>
                            <td className="px-4 py-2 font-medium text-foreground">{r.name}</td>
                            <td className="px-4 py-2 text-center">
                              {r.rca_correct ? (
                                <CheckCircle2 className="mx-auto h-4 w-4 text-status-healthy" />
                              ) : (
                                <XCircle className="mx-auto h-4 w-4 text-status-critical" />
                              )}
                            </td>
                            <td
                              className={cn(
                                "px-4 py-2 text-center tabular-nums",
                                r.blast_radius_recall >= 0.8
                                  ? "text-status-healthy"
                                  : r.blast_radius_recall >= 0.5
                                  ? "text-status-degraded"
                                  : "text-status-critical",
                              )}
                            >
                              {(r.blast_radius_recall * 100).toFixed(0)}%
                            </td>
                            <td className="px-4 py-2 text-center tabular-nums text-foreground">
                              {(r.runbook_recall * 100).toFixed(0)}%
                            </td>
                            <td className="px-4 py-2 text-right tabular-nums text-muted-foreground">
                              {r.duration.toFixed(1)}s
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot className="border-t border-border/60 bg-muted/20 font-mono">
                        <tr>
                          <td colSpan={2} className="px-4 py-2 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                            Average
                          </td>
                          <td className="px-4 py-2 text-center tabular-nums text-foreground">
                            {(summary.rcaAcc * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-2 text-center tabular-nums text-foreground">
                            {(summary.avgRecall * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-2 text-center tabular-nums text-foreground">
                            {(summary.avgRunbookRecall * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums text-foreground">
                            {summary.avgDuration.toFixed(1)}s
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </PageMount>
  );
}

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <Card className="p-0">
      <CardContent className="p-3">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/80">
          {label}
        </p>
        <p className="mt-1.5 text-2xl font-semibold leading-none tabular-nums tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
