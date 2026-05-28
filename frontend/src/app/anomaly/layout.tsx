import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Anomaly Injection",
  description:
    "Dense fault-control surface — manual single-service injection, preset cascade scenarios, active fault ledger, and an event journal.",
};

export default function Layout({ children }: { children: ReactNode }) {
  return children;
}
