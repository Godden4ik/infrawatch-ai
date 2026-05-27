"use client";

import {
  BaseEdge,
  EdgeLabelRenderer,
  type Edge,
  type EdgeProps,
} from "@xyflow/react";
import { cn } from "@/lib/utils";

export type TopologyEdgeData = {
  affected: boolean;
  selected: boolean;
  routeGroup: "gateway" | "datastore" | "lateral";
  lane: number;
};

export type TopologyGraphEdge = Edge<TopologyEdgeData, "topology">;

export function TopologyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  label,
  data,
}: EdgeProps) {
  const edgeData = data as TopologyEdgeData | undefined;
  const lane = edgeData?.lane ?? 0;
  const routeGroup = edgeData?.routeGroup ?? "gateway";
  const path =
    routeGroup === "lateral"
      ? [
          `M ${sourceX} ${sourceY}`,
          `L ${sourceX} ${sourceY + 44}`,
          `L ${sourceX} ${sourceY + 44 + lane * 18}`,
          `L ${targetX} ${sourceY + 44 + lane * 18}`,
          `L ${targetX} ${targetY - 18}`,
          `L ${targetX} ${targetY}`,
        ].join(" ")
      : routeGroup === "datastore"
        ? [
            `M ${sourceX} ${sourceY}`,
            `L ${sourceX} ${sourceY + 34 + lane * 12}`,
            `L ${targetX} ${sourceY + 34 + lane * 12}`,
            `L ${targetX} ${targetY}`,
          ].join(" ")
        : [
            `M ${sourceX} ${sourceY}`,
            `L ${sourceX} ${sourceY + 36 + lane * 14}`,
            `L ${targetX} ${sourceY + 36 + lane * 14}`,
            `L ${targetX} ${targetY}`,
          ].join(" ");
  const labelX = (sourceX + targetX) / 2;
  const labelY =
    routeGroup === "lateral"
      ? sourceY + 30 + lane * 18
      : sourceY + 22 + lane * 14;

  const arrowColor = edgeData?.selected
    ? "var(--brand)"
    : edgeData?.affected
      ? "var(--status-critical)"
      : "var(--muted-foreground)";
  const arrowPath = `M ${targetX - 5} ${targetY - 8} L ${targetX} ${targetY - 1} L ${targetX + 5} ${targetY - 8} Z`;

  return (
    <>
      <BaseEdge
        id={`${id}-track`}
        path={path}
        style={{
          stroke: "var(--border)",
          strokeOpacity: 0.28,
          strokeWidth: 2,
        }}
      />
      <BaseEdge
        id={id}
        path={path}
        className={cn(
          "topology-edge-path",
          edgeData?.affected ? "topology-edge-path--affected" : undefined,
          edgeData?.selected ? "topology-edge-path--selected" : undefined,
        )}
      />
      <path
        d={arrowPath}
        fill={arrowColor}
        fillOpacity={edgeData?.affected || edgeData?.selected ? 0.95 : 0.55}
      />

      {label && edgeData?.selected ? (
        <EdgeLabelRenderer>
          <div
            className="pointer-events-none absolute border border-border/80 bg-background/95 px-2 py-1 font-mono text-[10px] tracking-[0.16em] uppercase text-muted-foreground"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
