"use client";

import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { topologyQueryOptions } from "@/services/graph/query-options";
import { Skeleton } from "@/components/ui/skeleton";

interface TopologyGraphProps {
  selectedService: string | null;
  affectedServices: string[];
  onNodeClick: (serviceName: string) => void;
}

export function TopologyGraph({
  selectedService,
  affectedServices,
  onNodeClick,
}: TopologyGraphProps) {
  const { data, isLoading } = useQuery(topologyQueryOptions);

  const nodes: Node[] = useMemo(() => {
    if (!data) return [];
    const count = data.nodes.length;
    const radius = 280;
    const cx = 400;
    const cy = 380;
    return data.nodes.map((n, i) => {
      const angle = (2 * Math.PI * i) / count - Math.PI / 2;
      const isSelected = n.name === selectedService;
      const isAffected = affectedServices.includes(n.name);
      return {
        id: n.name,
        position: {
          x: cx + radius * Math.cos(angle),
          y: cy + radius * Math.sin(angle),
        },
        data: { label: n.name },
        style: {
          background: isSelected
            ? "#3b82f6"
            : isAffected
              ? "rgba(239, 68, 68, 0.12)"
              : "rgba(30, 41, 59, 0.85)",
          color: isSelected ? "#ffffff" : isAffected ? "#fca5a5" : "#e2e8f0",
          border: isSelected
            ? "2px solid #60a5fa"
            : isAffected
              ? "1px solid rgba(239, 68, 68, 0.4)"
              : "1px solid rgba(71, 85, 105, 0.4)",
          borderRadius: "12px",
          padding: "14px 24px",
          fontSize: "13px",
          fontFamily: "var(--font-mono), monospace",
          fontWeight: isSelected || isAffected ? 600 : 500,
          letterSpacing: "0.01em",
          boxShadow: isSelected
            ? "0 0 20px rgba(59, 130, 246, 0.25), 0 4px 12px rgba(0,0,0,0.2)"
            : isAffected
              ? "0 0 16px rgba(239, 68, 68, 0.15)"
              : "0 2px 8px rgba(0,0,0,0.15)",
          cursor: "pointer",
        },
      };
    });
  }, [data, selectedService, affectedServices]);

  const edges: Edge[] = useMemo(() => {
    if (!data) return [];
    return data.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      label: e.relationship,
      animated:
        affectedServices.includes(e.source) ||
        affectedServices.includes(e.target),
      style: {
        stroke: affectedServices.includes(e.source) || affectedServices.includes(e.target)
          ? "rgba(239, 68, 68, 0.5)"
          : "rgba(71, 85, 105, 0.5)",
        strokeWidth: 1.5,
      },
      labelStyle: {
        fontSize: 11,
        fill: "#94a3b8",
        fontFamily: "var(--font-mono), monospace",
        letterSpacing: "0.03em",
      },
      labelBgStyle: { fill: "rgba(15, 23, 42, 0.9)", fillOpacity: 1 },
      labelBgPadding: [6, 8] as [number, number],
      labelBgBorderRadius: 6,
    }));
  }, [data, affectedServices]);

  const handleNodeClick: NodeMouseHandler = useCallback(
    (_, node) => onNodeClick(node.id),
    [onNodeClick],
  );

  if (isLoading) return <Skeleton className="h-full w-full rounded-xl" />;

  return (
    <div className="h-full w-full">
      <style>{`
        .react-flow__controls {
          background: rgba(15, 23, 42, 0.92) !important;
          border: 1px solid rgba(71, 85, 105, 0.4) !important;
          border-radius: 10px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.3) !important;
          overflow: hidden !important;
        }
        .react-flow__controls-button {
          background: transparent !important;
          border-bottom: 1px solid rgba(71, 85, 105, 0.25) !important;
          fill: #94a3b8 !important;
          color: #94a3b8 !important;
          width: 32px !important;
          height: 32px !important;
        }
        .react-flow__controls-button:hover {
          background: rgba(59, 130, 246, 0.12) !important;
          fill: #60a5fa !important;
        }
        .react-flow__controls-button:last-child {
          border-bottom: none !important;
        }
        .react-flow__controls-button svg {
          max-width: 14px !important;
          max-height: 14px !important;
        }
        .react-flow__edge-textbg {
          fill: rgba(15, 23, 42, 0.9) !important;
        }
        .react-flow__edge-text {
          fill: #94a3b8 !important;
        }
        .react-flow__pane {
          cursor: grab !important;
        }
      `}</style>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodeClick={handleNodeClick}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        proOptions={{ hideAttribution: true }}
        minZoom={0.3}
        maxZoom={2}
      >
        <Background color="rgba(71, 85, 105, 0.08)" gap={24} size={1} />
        <Controls position="bottom-right" />
      </ReactFlow>
    </div>
  );
}
