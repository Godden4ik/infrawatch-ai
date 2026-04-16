"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
  type NodeMouseHandler,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { topologyQueryOptions } from "@/services/graph/query-options";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TopologyEdge,
  type TopologyGraphEdge,
} from "./topology-edge";
import {
  TopologyNode,
  type TopologyGraphNode,
} from "./topology-node";

interface TopologyGraphProps {
  selectedService: string | null;
  affectedServices: string[];
  onNodeClick: (serviceName: string) => void;
  onPaneClick?: () => void;
}

const FIXED_POSITIONS: Record<string, { x: number; y: number }> = {
  "api-gateway": { x: 0, y: 40 },
  "order-service": { x: -320, y: 290 },
  "payment-service": { x: 0, y: 290 },
  "user-service": { x: 320, y: 290 },
  "redis-cache": { x: 0, y: 570 },
};

const nodeTypes: NodeTypes = {
  topology: TopologyNode,
};

const edgeTypes: EdgeTypes = {
  topology: TopologyEdge,
};

export function TopologyGraph({
  selectedService,
  affectedServices,
  onNodeClick,
  onPaneClick,
}: TopologyGraphProps) {
  const { data, isLoading } = useQuery(topologyQueryOptions);

  const nodes: TopologyGraphNode[] = !data
    ? []
    : data.nodes.map((node) => {
        const isSelected = node.name === selectedService;
        const isAffected = affectedServices.includes(node.name);

        return {
          id: node.name,
          type: "topology",
          sourcePosition: Position.Bottom,
          targetPosition: Position.Top,
          position: FIXED_POSITIONS[node.name] ?? { x: 0, y: 0 },
          data: {
            name: node.name,
            typeLabel: node.type ?? "service",
            labels: node.labels.slice(0, 1),
            selected: isSelected,
            affected: isAffected,
          },
        };
      });

  const edges: TopologyGraphEdge[] = !data
    ? []
    : data.edges.map((edge, index) => {
        const isSelected =
          edge.source === selectedService || edge.target === selectedService;
        const isAffected =
          affectedServices.includes(edge.source) ||
          affectedServices.includes(edge.target);
        const routeKey = `${edge.source}->${edge.target}`;
        const routeMeta: Record<
          string,
          { routeGroup: "gateway" | "datastore" | "lateral"; lane: number }
        > = {
          "api-gateway->order-service": { routeGroup: "gateway", lane: 0 },
          "api-gateway->payment-service": { routeGroup: "gateway", lane: 1 },
          "api-gateway->user-service": { routeGroup: "gateway", lane: 2 },
          "order-service->redis-cache": { routeGroup: "datastore", lane: 0 },
          "payment-service->redis-cache": { routeGroup: "datastore", lane: 1 },
          "user-service->redis-cache": { routeGroup: "datastore", lane: 2 },
          "order-service->payment-service": { routeGroup: "lateral", lane: 0 },
        };
        const route = routeMeta[routeKey] ?? {
          routeGroup: "gateway" as const,
          lane: 0,
        };

        return {
          id: `edge-${index}-${edge.source}-${edge.target}`,
          type: "topology",
          source: edge.source,
          target: edge.target,
          label: edge.relationship.replaceAll("_", " "),
          data: {
            affected: isAffected,
            selected: isSelected,
            routeGroup: route.routeGroup,
            lane: route.lane,
          },
        };
      });

  const handleNodeClick: NodeMouseHandler = (_, node) => {
    onNodeClick(node.id);
  };

  if (isLoading) {
    return <Skeleton className="h-full w-full" />;
  }

  return (
    <div className="relative h-full w-full">
      <style>{`
        @keyframes topology-dash {
          to {
            stroke-dashoffset: -48;
          }
        }

        .topology-edge-path {
          fill: none;
          stroke: var(--muted-foreground);
          stroke-opacity: 0.42;
          stroke-width: 1.75;
          stroke-dasharray: 4 7;
          animation: topology-dash 14s linear infinite;
        }

        .topology-edge-path--selected {
          stroke: var(--primary);
          stroke-opacity: 0.9;
          animation-duration: 8s;
        }

        .topology-edge-path--affected {
          stroke: var(--destructive);
          stroke-opacity: 0.72;
          animation-duration: 6s;
        }

        .react-flow__controls {
          background: color-mix(in oklab, var(--card) 92%, transparent) !important;
          border: 1px solid color-mix(in oklab, var(--border) 100%, transparent) !important;
          border-radius: 0 !important;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24) !important;
          overflow: hidden !important;
        }

        .react-flow__controls-button {
          background: transparent !important;
          border-bottom: 1px solid color-mix(in oklab, var(--border) 90%, transparent) !important;
          color: var(--muted-foreground) !important;
          fill: var(--muted-foreground) !important;
          width: 34px !important;
          height: 34px !important;
        }

        .react-flow__controls-button:hover {
          background: color-mix(in oklab, var(--card) 75%, var(--primary) 25%) !important;
          color: var(--foreground) !important;
          fill: var(--foreground) !important;
        }

        .react-flow__controls-button:last-child {
          border-bottom: 0 !important;
        }

        .react-flow__pane {
          cursor: grab !important;
        }

        .react-flow__pane.dragging {
          cursor: grabbing !important;
        }
      `}</style>

      <div className="pointer-events-none absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2">
        <div className="border border-border/80 bg-background/92 px-2.5 py-1.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm">
          Click node to inspect
        </div>
        <div className="border border-border/80 bg-background/92 px-2.5 py-1.5 backdrop-blur-sm">
          <div className="flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-chart-2" />
              Normal
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Selected
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-destructive" />
              Affected
            </span>
          </div>
        </div>
      </div>

      <ReactFlow<TopologyGraphNode, TopologyGraphEdge>
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={handleNodeClick}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.12, maxZoom: 1 }}
        minZoom={0.45}
        maxZoom={1.8}
        nodesDraggable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Lines}
          gap={32}
          size={1}
          color="var(--border)"
        />
        <Controls position="bottom-right" showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
