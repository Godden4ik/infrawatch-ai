"use client";

import { useEffect, useSyncExternalStore } from "react";

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

/* ── Module-level singleton store ── */

let state: StreamState = { services: {}, status: "connecting" };
const listeners = new Set<() => void>();
let refCount = 0;
let eventSource: EventSource | null = null;

function getSnapshot() {
  return state;
}

function getServerSnapshot() {
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
      const last = existing[existing.length - 1];
      if (last && last.time === timestamp) {
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

function connect() {
  refCount++;
  if (eventSource) return;

  const es = new EventSource("/api/metrics/stream");

  es.addEventListener("metrics", (event) => {
    try {
      const data = JSON.parse(event.data);
      pushEvent(data.timestamp, data.services);
    } catch {
      // skip malformed events
    }
  });

  es.addEventListener("error", () => {
    emit({ ...state, status: "error" });
  });

  es.onopen = () => {
    emit({ ...state, status: "live" });
  };

  eventSource = es;
}

function disconnect() {
  refCount--;
  if (refCount <= 0 && eventSource) {
    eventSource.close();
    eventSource = null;
    refCount = 0;
  }
}

/* ── Hook ── */

export function useMetricsStream() {
  useEffect(() => {
    connect();
    return disconnect;
  }, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
