"use client";

import { usePathname } from "next/navigation";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Overview",
  "/dashboard": "Service Health",
  "/anomaly": "Anomaly Injection",
  "/pipeline": "Agent Pipeline",
  "/topology": "Topology",
  "/evaluation": "RAG Evaluation",
  "/providers": "Providers",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const label = ROUTE_LABELS[pathname] ?? pathname.slice(1);

  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="text-muted-foreground/50">InfraWatch</span>
      <span className="text-muted-foreground/30">/</span>
      <span className="text-foreground font-medium">{label}</span>
    </nav>
  );
}
