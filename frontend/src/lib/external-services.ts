import { SiPrometheus, SiGrafana, SiNeo4J } from "react-icons/si";
import type { IconType } from "react-icons";
import { env } from "@/env";

export type ExternalService = {
  id: string;
  label: string;
  url: string;
  icon: IconType;
  description: string;
};

export const EXTERNAL_SERVICES: ExternalService[] = [
  {
    id: "grafana",
    label: "Grafana",
    url: env.NEXT_PUBLIC_GRAFANA_URL,
    icon: SiGrafana,
    description: "Dashboards & alerting",
  },
  {
    id: "prometheus",
    label: "Prometheus",
    url: env.NEXT_PUBLIC_PROMETHEUS_URL,
    icon: SiPrometheus,
    description: "Metrics & queries",
  },
  {
    id: "neo4j",
    label: "Neo4j",
    url: env.NEXT_PUBLIC_NEO4J_URL,
    icon: SiNeo4J,
    description: "Graph browser",
  },
];

export const EXTERNAL_SERVICE_BY_ID: Record<string, ExternalService> =
  Object.fromEntries(EXTERNAL_SERVICES.map((s) => [s.id, s]));
