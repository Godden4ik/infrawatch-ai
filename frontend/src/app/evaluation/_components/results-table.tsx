"use client";

import { motion } from "motion/react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Network, Layers, FileQuestion } from "lucide-react";
import type { RagResult, GraphragChunk, NaiveChunk } from "@/services/rag/schema";
import { cn } from "@/lib/utils";

interface ResultsTableProps {
  data: RagResult;
}

function ResultItem({
  item,
  index,
  hasGraphContext,
}: {
  item: Record<string, unknown>;
  index: number;
  hasGraphContext?: boolean;
}) {
  const title = (item.title as string) ?? `Result ${index + 1}`;
  const severity = item.severity as string | undefined;
  const steps = item.steps as string[] | undefined;
  const graphContext = item.graph_context as Record<string, unknown> | undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-secondary/30 rounded-xl p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h4 className="text-sm font-medium leading-snug">{title}</h4>
        {severity && (
          <Badge
            variant="secondary"
            className={cn(
              "shrink-0 font-mono text-[10px] uppercase",
              severity === "critical" && "bg-red-500/15 text-red-400",
              severity === "high" && "bg-amber-500/15 text-amber-400",
              severity === "medium" && "bg-blue-500/15 text-blue-400",
              severity === "low" && "bg-emerald-500/15 text-emerald-400",
            )}
          >
            {severity}
          </Badge>
        )}
      </div>

      {steps && steps.length > 0 && (
        <ol className="text-muted-foreground mt-2 space-y-1 pl-4 text-xs">
          {steps.map((step, i) => (
            <li key={i} className="list-decimal leading-relaxed">
              {step}
            </li>
          ))}
        </ol>
      )}

      {typeof item.resolution === "string" && (
        <p className="text-muted-foreground mt-2 text-xs">
          Resolution: {item.resolution}
        </p>
      )}

      {graphContext && hasGraphContext && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-border/30 pt-3">
          {Object.entries(graphContext).map(([key, val]) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-1 font-mono text-[11px] text-blue-400"
            >
              <Network className="h-3 w-3" />
              {key}: {JSON.stringify(val)}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

const SOURCE_SYSTEM_COLORS: Record<string, string> = {
  kubernetes: "bg-cyan-500/15 text-cyan-400",
  postgresql: "bg-emerald-500/15 text-emerald-400",
  nginx: "bg-orange-500/15 text-orange-400",
  "sre-theory": "bg-purple-500/15 text-purple-400",
};

function GraphragChunkItem({ chunk, index }: { chunk: GraphragChunk; index: number }) {
  const colorClass = SOURCE_SYSTEM_COLORS[chunk.source_system] ?? "bg-secondary text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h4 className="text-sm font-medium leading-snug">{chunk.document_title}</h4>
        <Badge variant="secondary" className={cn("shrink-0 font-mono text-[10px]", colorClass)}>
          {chunk.source_system}
        </Badge>
      </div>
      <div className="mb-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>chunk {chunk.chunk_index}</span>
        <span>·</span>
        <span>score {chunk.score.toFixed(3)}</span>
        <span>·</span>
        {chunk.related_services.length > 0 ? (
          <span className="text-blue-400">services: {chunk.related_services.join(", ")}</span>
        ) : (
          <span className="text-amber-400/80">no related services — topologically disconnected</span>
        )}
      </div>
      <p className="line-clamp-3 text-xs text-muted-foreground/70">{chunk.content}</p>
    </motion.div>
  );
}

function NaiveChunkItem({ chunk, index }: { chunk: NaiveChunk; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-secondary/30 rounded-xl p-4"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <h4 className="text-sm font-medium leading-snug">{chunk.document_title}</h4>
        <span className="shrink-0 font-mono text-[10px] text-muted-foreground/50">
          score {chunk.score.toFixed(3)}
        </span>
      </div>
      <p className="line-clamp-3 text-xs text-muted-foreground/70">{chunk.content}</p>
    </motion.div>
  );
}

function ResultColumn({
  title,
  subtitle,
  icon: Icon,
  color,
  items,
  hasGraphContext,
  graphragChunks,
  naiveChunks,
}: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  color: string;
  items: { runbooks: Record<string, unknown>[]; incidents: Record<string, unknown>[] };
  hasGraphContext?: boolean;
  graphragChunks?: GraphragChunk[];
  naiveChunks?: NaiveChunk[];
}) {
  return (
    <div className="flex-1 space-y-4">
      <div className="flex items-center gap-3">
        <div
          className="flex h-9 w-9 items-center justify-center rounded-lg"
          style={{ background: `${color}15` }}
        >
          <Icon className="h-4.5 w-4.5" style={{ color }} />
        </div>
        <div>
          <h3 className="text-base font-semibold">{title}</h3>
          <p className="text-muted-foreground text-xs">{subtitle}</p>
        </div>
      </div>

      <ScrollArea className="h-[600px] pr-2">
        <div className="space-y-5">
          {items.runbooks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-muted-foreground/60 text-xs font-medium uppercase tracking-widest">
                Runbooks ({items.runbooks.length})
              </h4>
              {items.runbooks.map((item, i) => (
                <ResultItem key={i} item={item} index={i} hasGraphContext={hasGraphContext} />
              ))}
            </div>
          )}

          {items.incidents.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-muted-foreground/60 text-xs font-medium uppercase tracking-widest">
                Incidents ({items.incidents.length})
              </h4>
              {items.incidents.map((item, i) => (
                <ResultItem key={i} item={item} index={i} hasGraphContext={hasGraphContext} />
              ))}
            </div>
          )}

          {graphragChunks && graphragChunks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileQuestion className="h-3.5 w-3.5 text-amber-400/70" />
                <h4 className="text-xs font-medium uppercase tracking-widest text-amber-400/70">
                  Noise chunks ({graphragChunks.length})
                </h4>
              </div>
              <p className="text-[11px] text-muted-foreground/50">
                High similarity score but no service relationships — graph context exposes them as unrelated.
              </p>
              {graphragChunks.map((ck, i) => (
                <GraphragChunkItem key={ck.chunk_id} chunk={ck} index={i} />
              ))}
            </div>
          )}

          {naiveChunks && naiveChunks.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FileQuestion className="h-3.5 w-3.5 text-muted-foreground/40" />
                <h4 className="text-muted-foreground/40 text-xs font-medium uppercase tracking-widest">
                  Noise chunks ({naiveChunks.length})
                </h4>
              </div>
              <p className="text-[11px] text-muted-foreground/50">
                Same documents — but source system and topology context are unknown.
              </p>
              {naiveChunks.map((ck, i) => (
                <NaiveChunkItem key={ck.chunk_id} chunk={ck} index={i} />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

export function ResultsTable({ data }: ResultsTableProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.2 }}
      className="flex gap-6"
    >
      <ResultColumn
        title="GraphRAG"
        subtitle="Topology-aware retrieval"
        icon={Network}
        color="#3b82f6"
        hasGraphContext
        items={{
          runbooks: data.graphrag.runbook_results,
          incidents: data.graphrag.incident_results,
        }}
        graphragChunks={data.graphrag.chunk_results}
      />
      <div className="bg-border/50 w-px shrink-0" />
      <ResultColumn
        title="Naive RAG"
        subtitle="Embedding-only retrieval"
        icon={Layers}
        color="#6b7280"
        items={{
          runbooks: data.naive.runbook_results,
          incidents: data.naive.incident_results,
        }}
        naiveChunks={data.naive.chunk_results}
      />
    </motion.div>
  );
}
