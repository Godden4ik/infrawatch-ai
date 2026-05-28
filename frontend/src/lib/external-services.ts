import { SiPrometheus, SiGrafana, SiNeo4J } from "react-icons/si";
import type { IconType } from "react-icons";

export type ExternalServiceId = "grafana" | "prometheus" | "neo4j";

export type ExternalServiceMeta = {
  id: ExternalServiceId;
  label: string;
  icon: IconType;
  description: string;
};

/**
 * Static metadata. URLs intentionally not embedded here — they're read
 * server-side at request time (env.PUBLIC_*_URL) and threaded through
 * the ExternalServicesProvider so a .env change applies without
 * rebuilding the frontend bundle.
 */
export const EXTERNAL_SERVICES_META: ExternalServiceMeta[] = [
  {
    id: "grafana",
    label: "Grafana",
    icon: SiGrafana,
    description: "Dashboards & alerting",
  },
  {
    id: "prometheus",
    label: "Prometheus",
    icon: SiPrometheus,
    description: "Metrics & queries",
  },
  {
    id: "neo4j",
    label: "Neo4j",
    icon: SiNeo4J,
    description: "Graph browser",
  },
];
