import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Service Topology",
  description:
    "Orthogonal Neo4j-backed dependency graph with live blast-radius highlighting. Select a node to inspect dependent services and failure spread.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
