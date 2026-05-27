"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export type TopologyNodeData = {
  name: string;
  typeLabel: string;
  labels: string[];
  selected: boolean;
  affected: boolean;
};

export type TopologyGraphNode = Node<TopologyNodeData, "topology">;

export function TopologyNode({ data }: NodeProps) {
  const nodeData = data as TopologyNodeData;

  return (
    <div
      className={cn(
        "relative min-w-[220px] border bg-card px-4 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-colors",
        nodeData.selected
          ? "border-brand text-foreground ring-1 ring-brand/30"
          : nodeData.affected
            ? "border-status-critical/70 bg-status-critical-soft/40 text-foreground"
            : "border-border text-foreground",
      )}
      style={{ viewTransitionName: `node-${nodeData.name}` }}
    >
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-px",
          nodeData.selected
            ? "bg-brand"
            : nodeData.affected
              ? "bg-status-critical/80"
              : "bg-border/80",
        )}
      />

      <Handle
        type="target"
        position={Position.Top}
        className="!h-2 !w-2 !border-0 !bg-transparent opacity-0"
      />

      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            {nodeData.typeLabel}
          </p>
          <p className="font-mono text-sm font-semibold tracking-tight">
            {nodeData.name}
          </p>
        </div>

        <span
          className={cn(
            "mt-1 h-2.5 w-2.5 shrink-0 rounded-full",
            nodeData.selected
              ? "bg-brand"
              : nodeData.affected
                ? "bg-status-critical"
                : "bg-status-healthy",
          )}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-1">
        {nodeData.labels.map((label: string) => (
          <Badge
            key={label}
            variant="outline"
            className="h-5 border-border/80 bg-muted/35 px-1.5 font-mono text-[10px] uppercase text-muted-foreground"
          >
            {label}
          </Badge>
        ))}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!h-2 !w-2 !border-0 !bg-transparent opacity-0"
      />
    </div>
  );
}
