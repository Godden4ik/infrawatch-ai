"use client";

import { createContext, useContext, type ReactNode } from "react";
import {
  EXTERNAL_SERVICES_META,
  type ExternalServiceId,
  type ExternalServiceMeta,
} from "@/lib/external-services";

export type ExternalServiceUrls = Record<ExternalServiceId, string>;

export type ExternalService = ExternalServiceMeta & { url: string };

const ExternalServiceUrlsContext = createContext<ExternalServiceUrls | null>(
  null,
);

export function ExternalServicesProvider({
  urls,
  children,
}: {
  urls: ExternalServiceUrls;
  children: ReactNode;
}) {
  return (
    <ExternalServiceUrlsContext.Provider value={urls}>
      {children}
    </ExternalServiceUrlsContext.Provider>
  );
}

export function useExternalServices(): ExternalService[] {
  const urls = useContext(ExternalServiceUrlsContext);
  if (!urls) {
    throw new Error(
      "useExternalServices must be used within ExternalServicesProvider",
    );
  }
  return EXTERNAL_SERVICES_META.map((meta) => ({
    ...meta,
    url: urls[meta.id],
  }));
}

export function useExternalServiceById(
  id: ExternalServiceId,
): ExternalService | undefined {
  return useExternalServices().find((s) => s.id === id);
}
