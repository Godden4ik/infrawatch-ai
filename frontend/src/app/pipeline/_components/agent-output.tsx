"use client";

import { motion, AnimatePresence } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Eye, Search, Wrench, Terminal, Check } from "lucide-react";
import ReactMarkdown from "react-markdown";

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
  { label: string; description: string; icon: React.ElementType; color: string }
> = {
  monitor: {
    label: "Monitor",
    description: "Polls Prometheus & Grafana, detects anomalies",
    icon: Eye,
    color: "#3b82f6",
  },
  analyst: {
    label: "Analyst",
    description: "Queries Neo4j topology for root cause",
    icon: Search,
    color: "#a855f7",
  },
  responder: {
    label: "Responder",
    description: "Drafts remediation plan from runbooks",
    icon: Wrench,
    color: "#22c55e",
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
    color: "#3b82f6",
  };
  const Icon = config.icon;
  const hasContent = data && (data.tokens || data.toolCalls.length > 0);
  const isComplete = !!data?.result;
  const isRunning = hasContent && !isComplete;
  const isIdle = !hasContent;

  return (
    <div className="flex gap-5">
      {/* Timeline column */}
      <div className="flex flex-col items-center">
        {/* Step circle */}
        <motion.div
          className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{
            background: isComplete
              ? config.color
              : isRunning
                ? `${config.color}20`
                : "var(--color-secondary)",
            border: isRunning
              ? `2px solid ${config.color}`
              : isComplete
                ? "none"
                : "2px solid var(--color-border)",
          }}
          animate={
            isRunning
              ? { boxShadow: [`0 0 0px ${config.color}40`, `0 0 12px ${config.color}40`, `0 0 0px ${config.color}40`] }
              : {}
          }
          transition={isRunning ? { duration: 2, repeat: Infinity } : {}}
        >
          {isComplete ? (
            <Check className="h-4.5 w-4.5 text-white" />
          ) : (
            <span
              className="font-mono text-sm font-semibold"
              style={{ color: isRunning ? config.color : "var(--color-muted-foreground)" }}
            >
              {stepNumber}
            </span>
          )}
        </motion.div>

        {/* Connecting line */}
        {!isLast && (
          <div className="relative w-px flex-1">
            <div className="bg-border absolute inset-0" />
            {(isComplete || isRunning) && (
              <motion.div
                className="absolute top-0 w-full"
                style={{ background: config.color }}
                initial={{ height: 0 }}
                animate={{ height: isComplete ? "100%" : "50%" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            )}
          </div>
        )}
      </div>

      {/* Content column */}
      <div className="flex-1 pb-8">
        {/* Header */}
        <div className="flex items-center gap-3 pt-1.5">
          <Icon
            className="h-4 w-4"
            style={{ color: isIdle ? "var(--color-muted-foreground)" : config.color }}
          />
          <h3
            className="text-base font-semibold"
            style={{ color: isIdle ? "var(--color-muted-foreground)" : "var(--color-foreground)" }}
          >
            {config.label}
          </h3>
          <AnimatePresence mode="wait">
            {isRunning && (
              <motion.span
                key="running"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="font-mono text-xs font-medium"
                style={{ color: config.color }}
              >
                <motion.span
                  className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full"
                  style={{ background: config.color }}
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity }}
                />
                Processing
              </motion.span>
            )}
            {isComplete && (
              <motion.span
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="font-mono text-xs font-medium"
                style={{ color: config.color }}
              >
                Complete
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <p className="text-muted-foreground mt-0.5 text-sm">
          {config.description}
        </p>

        {/* Tool calls */}
        <AnimatePresence>
          {data?.toolCalls && data.toolCalls.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 space-y-1.5"
            >
              <p className="text-muted-foreground/60 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider">
                <Terminal className="h-3 w-3" />
                Tool Calls
              </p>
              {data.toolCalls.map((tc, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="bg-secondary/60 rounded-lg px-3 py-2 font-mono text-xs"
                >
                  <span style={{ color: config.color }}>{tc.tool}</span>
                  {tc.output && (
                    <span className="text-muted-foreground ml-2 truncate">
                      {tc.output.slice(0, 80)}
                    </span>
                  )}
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Token output */}
        {data?.tokens && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-4"
          >
            <ScrollArea className="bg-secondary/30 h-96 rounded-lg p-4">
              <ReactMarkdown
                components={{
                  h1: ({ children }) => <h1 className="mb-2 text-sm font-bold text-foreground">{children}</h1>,
                  h2: ({ children }) => <h2 className="mt-3 mb-1 text-sm font-semibold text-foreground">{children}</h2>,
                  h3: ({ children }) => <h3 className="mt-2 mb-1 text-xs font-semibold text-foreground">{children}</h3>,
                  p: ({ children }) => <p className="mb-2 text-xs leading-relaxed text-foreground/80">{children}</p>,
                  ul: ({ children }) => <ul className="mb-2 list-disc pl-4 text-xs text-foreground/80">{children}</ul>,
                  ol: ({ children }) => <ol className="mb-2 list-decimal pl-4 text-xs text-foreground/80">{children}</ol>,
                  li: ({ children }) => <li className="mb-0.5">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                  code: ({ children }) => (
                    <code className="bg-secondary rounded px-1 py-0.5 font-mono text-xs">{children}</code>
                  ),
                  pre: ({ children }) => (
                    <pre className="bg-secondary my-2 overflow-x-auto rounded p-2 font-mono text-xs">{children}</pre>
                  ),
                  table: ({ children }) => (
                    <table className="mb-2 w-full border-collapse text-xs">{children}</table>
                  ),
                  th: ({ children }) => <th className="border-border border px-2 py-1 text-left font-semibold text-foreground">{children}</th>,
                  td: ({ children }) => <td className="border-border border px-2 py-1 text-foreground/80">{children}</td>,
                  hr: () => <hr className="border-border my-3" />,
                }}
              >
                {data.tokens}
              </ReactMarkdown>
            </ScrollArea>
          </motion.div>
        )}

        {/* Idle state */}
        {isIdle && (
          <div className="text-muted-foreground/30 mt-3 flex items-center gap-2 font-mono text-sm">
            <motion.span
              className="inline-block h-1.5 w-1.5 rounded-full bg-current"
              animate={{ opacity: [0.15, 0.4, 0.15] }}
              transition={{ duration: 2.5, repeat: Infinity }}
            />
            Waiting for upstream...
          </div>
        )}
      </div>
    </div>
  );
}
