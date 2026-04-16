"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

export interface StreamPoint {
  time: string;
  value: number;
}

export type StreamStatus = "connecting" | "live" | "error";

interface StreamState {
  /** service -> metric_key -> points */
  services: Record<string, Record<string, StreamPoint[]>>;
  status: StreamStatus;
}

const MAX_BUFFER_SIZE = 150; // ~5min at 2s interval

function createMetricsStore() {
  let state: StreamState = { services: {}, status: "connecting" };
  const listeners = new Set<() => void>();

  function getSnapshot() {
    return state;
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  function emit(next: StreamState) {
    state = next;
    for (const l of listeners) l();
  }

  function pushEvent(timestamp: string, services: Record<string, Record<string, number | null>>) {
    const next: StreamState = { services: {}, status: "live" };

    for (const [service, metrics] of Object.entries(services)) {
      next.services[service] = {};
      const prev = state.services[service] ?? {};

      for (const [key, value] of Object.entries(metrics)) {
        const existing = prev[key] ?? [];
        if (value === null || value === undefined) {
          next.services[service][key] = existing;
          continue;
        }
        const point: StreamPoint = { time: timestamp, value };
        const updated = [...existing, point];
        if (updated.length > MAX_BUFFER_SIZE) {
          updated.splice(0, updated.length - MAX_BUFFER_SIZE);
        }
        next.services[service][key] = updated;
      }
    }

    emit(next);
  }

  function setStatus(status: StreamStatus) {
    emit({ ...state, status });
  }

  return { getSnapshot, subscribe, pushEvent, setStatus };
}

export function useMetricsStream() {
  const storeRef = useRef<ReturnType<typeof createMetricsStore>>();
  if (!storeRef.current) {
    storeRef.current = createMetricsStore();
  }
  const store = storeRef.current;

  useEffect(() => {
    const es = new EventSource("/api/metrics/stream");

    es.addEventListener("metrics", (event) => {
      try {
        const data = JSON.parse(event.data);
        store.pushEvent(data.timestamp, data.services);
      } catch {
        // skip malformed events
      }
    });

    es.addEventListener("error", () => {
      store.setStatus("error");
    });

    es.onopen = () => {
      store.setStatus("live");
    };

    return () => es.close();
  }, [store]);

  return useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
}
