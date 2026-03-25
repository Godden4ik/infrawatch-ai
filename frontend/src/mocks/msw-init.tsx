"use client";

import { useEffect, type ReactNode } from "react";

export function MswInit({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_MSW_ENABLED === "true") {
      import("./browser").then(async ({ worker }) => {
        await worker.start({ onUnhandledRequest: "bypass" });
        console.log("[MSW] Browser worker started");
      });
    }
  }, []);

  return <>{children}</>;
}
