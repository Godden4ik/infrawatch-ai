import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Service Health",
  description:
    "Live Prometheus metrics streaming across every monitored service — sparklines, full 26-metric live monitor, slice-hover tooltips.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
