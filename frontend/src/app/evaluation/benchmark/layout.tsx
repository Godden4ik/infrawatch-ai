import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Accuracy Benchmark",
  description:
    "Run the agent pipeline against a gold dataset and stream the live console — precision, recall, F1, and items-evaluated summarized on completion.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
