"use client";

import { AnimatePresence, motion } from "motion/react";
import ReactMarkdown from "react-markdown";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Search, Terminal, Wrench, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentOutputProps {
  agentName: string;
  stepNumber: number;
  isLast: boolean;
  data?: {
    tokens: string;
    toolCalls: Array<{ tool: string; output?: string }>;
    result?: Record<string, unknown>;
  };
}

const AGENT_CONFIG: Record<
  string,
  { label: string; description: string; icon: React.ElementType; tone: string; marker: string }
> = {
  monitor_node: {
    label: "Monitor",
    description: "Polls Prometheus and Grafana, detects anomalies",
    icon: Eye,
    tone: "text-primary",
    marker: "bg-primary",
  },
  analyst_node: {
    label: "Analyst",
    description: "Queries topology for root cause and blast radius",
    icon: Search,
    tone: "text-warning",
    marker: "bg-warning",
  },
  responder_node: {
    label: "Responder",
    description: "Drafts remediation plan from runbooks",
    icon: Wrench,
    tone: "text-success",
    marker: "bg-success",
  },
};

export function AgentOutput({
  agentName,
  stepNumber,
  isLast,
  data,
}: AgentOutputProps) {
  const config = AGENT_CONFIG[agentName] ?? {
    label: agentName,
    description: "",
    icon: Eye,
    tone: "text-primary",
    marker: "bg-primary",
  };
  const Icon = config.icon;
  const hasContent = !!data && (data.tokens.length > 0 || data.toolCalls.length > 0);
  const isComplete = !!data?.result;
  const isRunning = hasContent && !isComplete;
  const isIdle = !hasContent;

  return (
    <div className="flex gap-3">
      <div className="flex w-10 flex-col items-center">
        <motion.div
          className={cn(
            "relative z-10 flex h-8 w-8 items-center justify-center border border-border/70 bg-background/60 font-mono text-[11px] font-semibold text-muted-foreground",
            isRunning && config.tone,
            isComplete && "border-success/20 bg-success/10 text-success",
          )}
          animate={isRunning ? { opacity: [1, 0.55, 1] } : undefined}
          transition={isRunning ? { duration: 1.2, repeat: Infinity } : undefined}
        >
          {isComplete ? <Check className="h-3.5 w-3.5" /> : stepNumber}
        </motion.div>

        {!isLast ? (
          <div className="relative min-h-10 w-px flex-1 bg-border/70">
            {(isComplete || isRunning) && (
              <motion.div
                className={cn("absolute inset-x-0 top-0", config.marker)}
                initial={{ height: 0 }}
                animate={{ height: isComplete ? "100%" : "55%" }}
                transition={{ duration: 0.35, ease: "easeOut" }}
              />
            )}
          </div>
        ) : null}
      </div>

      <div className="flex-1 pb-3">
        <div className="space-y-3 bg-background/55 px-3 py-3 ring-1 ring-inset ring-border/60">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Icon
                  className={cn("h-3.5 w-3.5 text-muted-foreground", !isIdle && config.tone)}
                />
                <h3
                  className={cn(
                    "text-sm font-medium text-muted-foreground",
                    !isIdle && "text-foreground",
                  )}
                >
                  {config.label}
                </h3>
              </div>
              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>

            <AnimatePresence mode="wait">
              {isRunning ? (
                <motion.span
                  key="running"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={cn(
                    "font-mono text-[10px] uppercase tracking-[0.14em]",
                    config.tone,
                  )}
                >
                  running
                </motion.span>
              ) : null}
              {isComplete ? (
                <motion.span
                  key="done"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="font-mono text-[10px] uppercase tracking-[0.14em] text-success"
                >
                  complete
                </motion.span>
              ) : null}
            </AnimatePresence>
          </div>

          {data?.toolCalls && data.toolCalls.length > 0 ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-1.5">
              <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                <Terminal className="h-3 w-3" />
                Tool calls
              </p>
              {data.toolCalls.map((tc, i) => (
                <motion.div
                  key={`${tc.tool}-${i}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-muted/30 px-2.5 py-2 font-mono text-[11px] ring-1 ring-inset ring-border/60"
                >
                  <span className={config.tone}>{tc.tool}</span>
                  {tc.output ? (
                    <span className="ml-2 text-muted-foreground">
                      {tc.output.slice(0, 80)}
                    </span>
                  ) : null}
                </motion.div>
              ))}
            </motion.div>
          ) : null}

          {data?.tokens ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ScrollArea className="h-72 bg-muted/20 px-3 py-3 ring-1 ring-inset ring-border/60">
                <ReactMarkdown
                  components={{
                    h1: ({ children }) => (
                      <h1 className="mb-2 text-sm font-semibold text-foreground">{children}</h1>
                    ),
                    h2: ({ children }) => (
                      <h2 className="mb-1 mt-3 text-sm font-semibold text-foreground">{children}</h2>
                    ),
                    h3: ({ children }) => (
                      <h3 className="mb-1 mt-2 text-xs font-semibold text-foreground">{children}</h3>
                    ),
                    p: ({ children }) => (
                      <p className="mb-2 text-xs leading-relaxed text-foreground/80">{children}</p>
                    ),
                    ul: ({ children }) => (
                      <ul className="mb-2 list-disc pl-4 text-xs text-foreground/80">{children}</ul>
                    ),
                    ol: ({ children }) => (
                      <ol className="mb-2 list-decimal pl-4 text-xs text-foreground/80">{children}</ol>
                    ),
                    li: ({ children }) => <li className="mb-0.5">{children}</li>,
                    strong: ({ children }) => (
                      <strong className="font-semibold text-foreground">{children}</strong>
                    ),
                    code: ({ children }) => (
                      <code className="bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>
                    ),
                    pre: ({ children }) => (
                      <pre className="my-2 overflow-x-auto bg-muted px-2 py-2 font-mono text-xs">
                        {children}
                      </pre>
                    ),
                    table: ({ children }) => (
                      <table className="mb-2 w-full border-collapse text-xs">{children}</table>
                    ),
                    th: ({ children }) => (
                      <th className="border border-border px-2 py-1 text-left font-semibold text-foreground">
                        {children}
                      </th>
                    ),
                    td: ({ children }) => (
                      <td className="border border-border px-2 py-1 text-foreground/80">
                        {children}
                      </td>
                    ),
                    hr: () => <hr className="my-3 border-border" />,
                  }}
                >
                  {data.tokens}
                </ReactMarkdown>
              </ScrollArea>
            </motion.div>
          ) : null}

          {isIdle ? (
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              <motion.span
                className="inline-block h-1.5 w-1.5 bg-muted-foreground"
                animate={{ opacity: [0.2, 0.6, 0.2] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              Waiting for upstream
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
