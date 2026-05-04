"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { providerQueries } from "@/services/providers/query-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <motion.div
        className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="space-y-1.5">
          <h1 className="text-2xl font-semibold tracking-tight">Accuracy Benchmark</h1>
          <p className="text-sm text-muted-foreground">
            Run the agent pipeline against a gold dataset to measure precision and recall
          </p>
        </div>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        {/* Controls */}
        <div className="space-y-4">
          <Card className="bg-background/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Pipeline Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ProviderCombobox 
                value={selection}
                onChange={setSelection}
                label="Execution Provider"
              />

              {selectedProvider?.requires_key && (
                <div className="space-y-2">
                  <label className="text-[11px] uppercase tracking-wider text-muted-foreground">API Key (Optional)</label>
                  <Input
                    type="password"
                    placeholder="sk-..."
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    className="h-9 bg-background/50"
                  />
                  <p className="text-[10px] text-muted-foreground">Overrides .env if provided</p>
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
            <div className="flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <p className="text-xs font-medium">{error}</p>
            </div>
          )}
        </div>

        {/* Execution Logs */}
        <div className="space-y-6">
          <Card className="flex flex-col border-border/50 bg-background/40">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Terminal className="h-4 w-4 text-primary" />
                Live Console
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] w-full rounded-md border bg-black/40 p-4">
                <div className="space-y-1 font-mono text-[12px] leading-relaxed">
                  {logs.length === 0 && !isRunning && (
                    <p className="text-muted-foreground">Ready to start benchmark...</p>
                  )}
                  {logs.map((log, i) => (
                    <div key={i} className={cn(
                      "whitespace-pre-wrap",
                      log.includes("[ERROR]") ? "text-destructive" : 
                      log.includes("✅ PASS") ? "text-success" :
                      log.includes("❌ FAIL") ? "text-warning" :
                      "text-foreground/90"
                    )}>
                      {log}
                    </div>
                  ))}
                  <div ref={logEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Results Summary */}
          <AnimatePresence>
            {results && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Results Summary</h2>
                </div>

                <div className="overflow-hidden rounded-md border border-border/50">
                  <table className="w-full text-left text-[12px]">
                    <thead className="bg-muted/50 font-mono uppercase tracking-wider text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2">ID</th>
                        <th className="px-4 py-2">Scenario</th>
                        <th className="px-4 py-2 text-center">RCA</th>
                        <th className="px-4 py-2 text-center">BR Recall</th>
                        <th className="px-4 py-2 text-center">RB Recall</th>
                        <th className="px-4 py-2 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/50 bg-background/20 font-mono">
                      {results.map((r) => (
                        <tr key={r.id} className="hover:bg-muted/30">
                          <td className="px-4 py-2 text-muted-foreground">{r.id}</td>
                          <td className="px-4 py-2 font-medium">{r.name}</td>
                          <td className="px-4 py-2 text-center">
                            {r.rca_correct ? (
                              <CheckCircle2 className="mx-auto h-4 w-4 text-success" />
                            ) : (
                              <XCircle className="mx-auto h-4 w-4 text-destructive" />
                            )}
                          </td>
                          <td className={cn(
                            "px-4 py-2 text-center font-bold",
                            r.blast_radius_recall >= 0.8 ? "text-success" : 
                            r.blast_radius_recall >= 0.5 ? "text-warning" : "text-destructive"
                          )}>
                            {(r.blast_radius_recall * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-2 text-center">
                            {(r.runbook_recall * 100).toFixed(0)}%
                          </td>
                          <td className="px-4 py-2 text-right text-muted-foreground">
                            {r.duration.toFixed(1)}s
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-muted/30 font-bold">
                      <tr>
                        <td colSpan={2} className="px-4 py-2">AVERAGE</td>
                        <td className="px-4 py-2 text-center">
                          {(results.filter(r => r.rca_correct).length / results.length * 100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-2 text-center">
                          {(results.reduce((acc, r) => acc + r.blast_radius_recall, 0) / results.length * 100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-2 text-center">
                          {(results.reduce((acc, r) => acc + r.runbook_recall, 0) / results.length * 100).toFixed(0)}%
                        </td>
                        <td className="px-4 py-2 text-right">
                          {(results.reduce((acc, r) => acc + r.duration, 0) / results.length).toFixed(1)}s
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
