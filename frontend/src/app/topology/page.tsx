"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { blastRadiusQueryOptions } from "@/services/graph/query-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { X } from "lucide-react";
import { TopologyGraph } from "./_components/topology-graph";
import { BlastRadiusPanel } from "./_components/blast-radius-panel";

export default function TopologyPage() {
  const [selectedService, setSelectedService] = useState<string | null>(null);

  const { data: blastData } = useQuery({
    ...blastRadiusQueryOptions(selectedService ?? ""),
    enabled: !!selectedService,
  });

  const affectedServices = blastData?.affected_services ?? [];

  return (
    <div className="flex h-[calc(100vh-8.5rem)] flex-col gap-4">
      <motion.div
        className="sticky top-0 z-10 -mx-2 shrink-0 border-b border-border/60 bg-background/92 px-2 pb-3 backdrop-blur-md"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <div className="space-y-1.5">
          <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
            Analysis / dependency graph
          </p>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-lg font-semibold tracking-tight">Service Topology</h1>
              <p className="text-sm text-muted-foreground">
                Orthogonal service map with live blast-radius focus. Select node to inspect dependent services and failure spread.
              </p>
            </div>
            {selectedService ? (
              <button
                onClick={() => setSelectedService(null)}
                className="shrink-0 border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Clear Selection
              </button>
            ) : null}
          </div>
        </div>
      </motion.div>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="min-h-0 flex-1 gap-0 py-0">
          <TopologyGraph
            selectedService={selectedService}
            affectedServices={affectedServices}
            onNodeClick={setSelectedService}
            onPaneClick={() => setSelectedService(null)}
          />
        </Card>

        <Card className="min-h-0 gap-0 py-0">
          <CardHeader className="border-b border-border/70 py-4">
            {selectedService ? (
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                    Selected Service
                  </p>
                  <CardTitle className="font-mono text-sm font-semibold">
                    {selectedService}
                  </CardTitle>
                </div>

                <button
                  onClick={() => setSelectedService(null)}
                  className="border border-transparent p-1 text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <CardTitle className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
                  Blast Radius
                </CardTitle>
              </>
            )}
          </CardHeader>

          <ScrollArea className="min-h-0 flex-1">
            {selectedService ? (
              <BlastRadiusPanel service={selectedService} />
            ) : (
              <CardContent className="flex min-h-full items-center justify-center p-4">
                <div className="space-y-2 text-center">
                  <p className="font-mono text-sm text-foreground">No service selected</p>
                  <p className="text-xs text-muted-foreground">
                    Pick node in graph to inspect dependent services, runbooks, and failure spread.
                  </p>
                </div>
              </CardContent>
            )}
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
