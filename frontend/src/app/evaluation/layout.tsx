import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "RAG Evaluation",
  description:
    "Side-by-side comparison of GraphRAG (topology-aware retrieval) against naive embedding-only RAG using the same LLM-as-judge pipeline.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
