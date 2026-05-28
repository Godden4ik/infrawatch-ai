import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Agent Pipeline",
  description:
    "Split-pane SSE runtime console for the Monitor → Analyst → Responder LangGraph pipeline with terminal-style streaming output.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
