"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { useQuery } from "@tanstack/react-query";
import { blastRadiusQueryOptions } from "@/services/graph/query-options";
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
    <div className="flex h-[calc(100vh-5rem)] flex-col gap-4">
      <motion.div
        className="shrink-0 space-y-1.5"
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-semibold tracking-tight">
          Service Topology
        </h1>
        <p className="text-muted-foreground">
          Interactive dependency graph — click a node to see its blast radius
        </p>
      </motion.div>

      <div className="flex min-h-0 flex-1 gap-4">
        <div className="border-border/30 bg-card/30 flex-1 overflow-hidden rounded-xl border">
          <TopologyGraph
            selectedService={selectedService}
            affectedServices={affectedServices}
            onNodeClick={setSelectedService}
          />
        </div>
        {selectedService && (
          <div className="w-[340px] shrink-0">
            <BlastRadiusPanel
              service={selectedService}
              onClose={() => setSelectedService(null)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
