"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { blastRadiusQueryOptions } from "@/services/graph/query-options";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PageHeader } from "@/components/layout/page-header";
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
      <PageHeader
        eyebrow="Analysis / Dependency Graph"
        title="Service Topology"
        description="Orthogonal service map with live blast-radius focus. Select node to inspect dependent services and failure spread."
        actions={
          selectedService ? (
            <button
              onClick={() => setSelectedService(null)}
              className="shrink-0 border border-border bg-card px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
            >
              Clear Selection
            </button>
          ) : null
        }
      />

      <motion.div
        className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_340px]"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: {},
          visible: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
        }}
      >
        <motion.div
          className="min-h-0"
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
          }}
        >
          <Card className="h-full min-h-0 flex-1 gap-0 py-0">
            <TopologyGraph
              selectedService={selectedService}
              affectedServices={affectedServices}
              onNodeClick={setSelectedService}
              onPaneClick={() => setSelectedService(null)}
            />
          </Card>
        </motion.div>

        <motion.div
          className="min-h-0"
          variants={{
            hidden: { opacity: 0, y: 8 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.16, 1, 0.3, 1] } },
          }}
        >
        <Card className="h-full min-h-0 gap-0 py-0">
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
        </motion.div>
      </motion.div>
    </div>
  );
}
