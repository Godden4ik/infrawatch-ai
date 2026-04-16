"use client";

import { motion } from "motion/react";
import { Bot, CheckCircle2, RadioTower, TerminalSquare } from "lucide-react";
import { AGENT_ORDER, type PipelineState } from "@/services/pipeline/schema";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { AgentOutput } from "./agent-output";

interface PipelineViewerProps {
  state?: PipelineState;
}

function getConsoleStats(state: PipelineState | undefined) {
  if (!state) {
    return {
      completed: 0,
      toolCalls: 0,
      tokens: 0,
    };
  }

  const completed = AGENT_ORDER.filter((agent) => !!state.agents[agent]?.result).length;
  const toolCalls = Object.values(state.agents).reduce(
    (sum, agent) => sum + agent.toolCalls.length,
    0,
  );
  const tokens = Object.values(state.agents).reduce(
    (sum, agent) => sum + agent.tokens.length,
    0,
  );

  return { completed, toolCalls, tokens };
}

function statusTone(status: PipelineState["status"] | undefined) {
  if (status === "running") return "text-primary";
  if (status === "complete") return "text-success";
  if (status === "error") return "text-destructive";
  return "text-muted-foreground";
}

export function PipelineViewer({ state }: PipelineViewerProps) {
  const stats = getConsoleStats(state);

  if (!state) {
    return (
      <Card size="sm">
        <CardHeader className="border-b border-border/60">
          <CardTitle>Execution Console</CardTitle>
          <CardDescription>
            Launch a run to stream tokens, tool calls, and final outputs.
          </CardDescription>
          <CardAction>
            <Badge variant="outline" className="font-mono text-[10px] uppercase">
              Idle
            </Badge>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-3 pt-3">
          <div className="flex min-h-[520px] flex-col items-center justify-center gap-4 bg-muted/20 px-6 py-10 ring-1 ring-inset ring-border/60">
            <div className="flex h-12 w-12 items-center justify-center border border-border/70 bg-background/60 text-muted-foreground">
              <Bot className="h-5 w-5" />
            </div>
            <div className="max-w-xl text-center">
              <p className="text-sm font-medium text-foreground">
                Execution console waiting for first stream.
              </p>
              <p className="mt-2 text-xs leading-6 text-muted-foreground">
                Runtime output appears here once the pipeline starts. Each agent keeps
                its tokens, tool calls, and final result in sequence.
              </p>
            </div>

            <div className="grid w-full max-w-2xl gap-3 sm:grid-cols-3">
              {[
                {
                  icon: RadioTower,
                  label: "Live transport",
                  value: "SSE stream",
                },
                {
                  icon: TerminalSquare,
                  label: "Trace granularity",
                  value: "token + tool",
                },
                {
                  icon: CheckCircle2,
                  label: "Agent chain",
                  value: "3-stage pass",
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.label}
                    className="space-y-2 bg-background/60 px-3 py-3 ring-1 ring-inset ring-border/60"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {item.label}
                    </p>
                    <p className="font-mono text-xs text-foreground">{item.value}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm">
      <CardHeader className="border-b border-border/60">
        <CardTitle>Execution Console</CardTitle>
        <CardDescription>
          Full stream of tokens, tool invocations, and final outputs.
        </CardDescription>
        <CardAction>
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[10px] uppercase",
              state.status === "running" && "border-primary/20 bg-primary/10 text-primary",
              state.status === "complete" && "text-success",
              state.status === "error" && "border-destructive/20 bg-destructive/10 text-destructive",
            )}
          >
            {state.status}
          </Badge>
        </CardAction>
      </CardHeader>

      <CardContent className="space-y-3 pt-3">
        <div className="grid gap-2 sm:grid-cols-3">
          <div className="bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border/60">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Status
            </p>
            <p className={cn("mt-1 font-mono text-sm uppercase", statusTone(state.status))}>
              {state.status}
            </p>
          </div>
          <div className="bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border/60">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Agents done
            </p>
            <p className="mt-1 font-mono text-sm text-foreground">
              {stats.completed}/{AGENT_ORDER.length}
            </p>
          </div>
          <div className="bg-muted/30 px-3 py-2 ring-1 ring-inset ring-border/60">
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              Tool calls
            </p>
            <p className="mt-1 font-mono text-sm text-foreground">{stats.toolCalls}</p>
          </div>
        </div>

        {state.error ? (
          <div className="bg-destructive/10 px-3 py-2 text-xs text-destructive ring-1 ring-inset ring-destructive/20">
            {state.error}
          </div>
        ) : null}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25 }}
          className="min-h-[520px] space-y-1 bg-muted/10 px-3 py-3 ring-1 ring-inset ring-border/60"
        >
          {AGENT_ORDER.map((agent, index) => (
            <AgentOutput
              key={agent}
              agentName={agent}
              stepNumber={index + 1}
              isLast={index === AGENT_ORDER.length - 1}
              data={state.agents[agent]}
            />
          ))}
        </motion.div>

        <div className="flex items-center justify-between bg-muted/30 px-3 py-2 text-xs ring-1 ring-inset ring-border/60">
          <span className="font-mono uppercase tracking-[0.14em] text-muted-foreground">
            buffered chars
          </span>
          <span className="font-mono text-foreground">{stats.tokens}</span>
        </div>
      </CardContent>
    </Card>
  );
}
