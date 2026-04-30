# Live Monitoring Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SSE-based real-time streaming metrics section to `/dashboard` page with nivo charts for all 26 Prometheus metrics.

**Architecture:** FastAPI SSE endpoint polls Prometheus every 2s, batches all metrics into one event. Next.js proxies the SSE stream. React hook consumes EventSource, maintains circular buffers. nivo `ResponsiveLine` charts render in a dense scrollable grid grouped by service.

**Tech Stack:** FastAPI + httpx (backend SSE), Next.js API route (proxy), EventSource + React hooks (consumer), @nivo/line (charts), Tailwind CSS v4 + shadcn/ui (layout)

---

### Task 1: Backend Metric Registry + SSE Endpoint

**Files:**
- Create: `api_backend/routes/metrics_stream.py`
- Modify: `api_backend/app.py`

- [ ] **Step 1: Create metrics stream route with metric registry and SSE generator**

```python
# api_backend/routes/metrics_stream.py
"""SSE endpoint streaming all Prometheus metrics every 2 seconds."""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import AsyncGenerator

import httpx
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()
logger = logging.getLogger(__name__)

PROMETHEUS_URL = os.getenv("PROMETHEUS_URL", "http://localhost:9090")

# Metric registry: service -> list of (metric_key, promql)
METRIC_REGISTRY: dict[str, list[tuple[str, str]]] = {
    "api-gateway": [
        ("p95_latency", "histogram_quantile(0.95, gateway_request_duration_seconds_bucket)"),
        ("request_rate", 'rate(gateway_requests_total[30s])'),
        ("error_rate", 'rate(gateway_requests_total{status="5xx"}[30s])'),
        ("active_connections", "gateway_active_connections"),
    ],
    "payment-service": [
        ("p95_latency", "histogram_quantile(0.95, payment_processing_duration_seconds_bucket)"),
        ("transaction_rate", "rate(payment_transactions_total[30s])"),
        ("failure_rate", "payment_failure_rate"),
        ("pending_transactions", "payment_pending_transactions"),
        ("revenue_rate", "rate(payment_revenue_dollars_total[30s])"),
    ],
    "user-service": [
        ("p95_latency", "histogram_quantile(0.95, user_request_duration_seconds_bucket)"),
        ("auth_rate", "rate(user_auth_attempts_total[30s])"),
        ("auth_failure_rate", 'rate(user_auth_attempts_total{result="failure"}[30s])'),
        ("active_sessions", "user_active_sessions"),
        ("registration_rate", "rate(user_registrations_total[30s])"),
    ],
    "order-service": [
        ("p95_latency", "histogram_quantile(0.95, order_processing_duration_seconds_bucket)"),
        ("order_rate", "rate(order_processed_total[30s])"),
        ("queue_depth", "order_queue_depth"),
        ("error_rate", "rate(order_errors_total[30s])"),
    ],
    "redis-cache": [
        ("hit_ratio", "redis_cache_hit_ratio"),
        ("hits_rate", "rate(redis_cache_hits_total[30s])"),
        ("misses_rate", "rate(redis_cache_misses_total[30s])"),
        ("memory_used", "redis_memory_used_bytes"),
        ("memory_max", "redis_memory_max_bytes"),
        ("connected_clients", "redis_connected_clients"),
        ("evicted_keys_rate", "rate(redis_evicted_keys_total[30s])"),
        ("total_keys", "redis_keys_total"),
    ],
}


async def _query_prometheus(
    client: httpx.AsyncClient, promql: str
) -> float | None:
    """Execute instant query against Prometheus, return scalar value or None."""
    try:
        resp = await client.get(
            f"{PROMETHEUS_URL}/api/v1/query",
            params={"query": promql},
            timeout=5.0,
        )
        if resp.status_code != 200:
            return None
        data = resp.json()
        results = data.get("data", {}).get("result", [])
        if not results:
            return None
        # Take first series, last value
        raw = results[0].get("value", [None, None])
        if len(raw) < 2 or raw[1] is None:
            return None
        val = float(raw[1])
        if not __import__("math").isfinite(val):
            return None
        return val
    except Exception as exc:
        logger.debug("Prometheus query failed for %s: %s", promql, exc)
        return None


async def _collect_all_metrics(
    client: httpx.AsyncClient,
) -> dict[str, dict[str, float | None]]:
    """Query all metrics in parallel, return {service: {metric_key: value}}."""
    tasks = []
    index: list[tuple[str, str]] = []  # (service, metric_key)

    for service, metrics in METRIC_REGISTRY.items():
        for metric_key, promql in metrics:
            tasks.append(_query_prometheus(client, promql))
            index.append((service, metric_key))

    values = await asyncio.gather(*tasks)

    result: dict[str, dict[str, float | None]] = {}
    for (service, metric_key), value in zip(index, values):
        result.setdefault(service, {})[metric_key] = value

    return result


async def _stream_metrics() -> AsyncGenerator[str, None]:
    """Yield SSE events with all metric values every 2 seconds."""
    async with httpx.AsyncClient() as client:
        while True:
            try:
                services = await _collect_all_metrics(client)
                event = {
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "services": services,
                }
                yield f"event: metrics\ndata: {json.dumps(event)}\nretry: 3000\n\n"
            except Exception as exc:
                logger.error("Metrics stream tick failed: %s", exc)
                error = {"error": str(exc)}
                yield f"event: error\ndata: {json.dumps(error)}\n\n"
            await asyncio.sleep(2)


@router.get("/stream")
async def stream_metrics():
    return StreamingResponse(
        _stream_metrics(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

- [ ] **Step 2: Register the route in app.py**

In `api_backend/app.py`, add the import and router:

```python
# Add to imports:
from api_backend.routes import health, pipeline, graph, anomaly, rag, providers, metrics_stream

# Add after the providers router line:
app.include_router(metrics_stream.router, prefix="/metrics", tags=["metrics"])
```

- [ ] **Step 3: Test the SSE endpoint manually**

Run: `cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && curl -N http://localhost:8090/metrics/stream 2>&1 | head -20`

Expected: SSE events appearing every 2 seconds with `event: metrics` and JSON data containing service metric values (values will be `null` if Prometheus is not running).

- [ ] **Step 4: Commit**

```bash
git add api_backend/routes/metrics_stream.py api_backend/app.py
git commit -m "feat: add SSE metrics stream endpoint

Polls all 26 Prometheus metrics every 2s, emits batched SSE events."
```

---

### Task 2: Frontend SSE Proxy Route

**Files:**
- Create: `frontend/src/app/api/metrics/stream/route.ts`

- [ ] **Step 1: Create the SSE proxy route**

The existing `_proxy.ts` already handles SSE streaming (detects `text/event-stream` content-type and returns `upstream.body` directly). But the metrics stream lives on the backend (`/metrics/stream`), not Prometheus. We need a dedicated route that proxies to the backend.

```typescript
// frontend/src/app/api/metrics/stream/route.ts
import { apiBackendUrl } from "@/services/_shared/fetch-server";

export async function GET() {
  const upstream = await fetch(`${apiBackendUrl}/metrics/stream`, {
    cache: "no-store",
    headers: { Accept: "text/event-stream" },
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

- [ ] **Step 2: Verify proxy works**

Open browser to `http://localhost:3001/api/metrics/stream` — should see raw SSE events streaming.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/api/metrics/stream/route.ts
git commit -m "feat: add Next.js SSE proxy for metrics stream"
```

---

### Task 3: Frontend Metric Registry

**Files:**
- Create: `frontend/src/lib/metric-registry.ts`

- [ ] **Step 1: Create metric registry with display names, formatters, and colors**

```typescript
// frontend/src/lib/metric-registry.ts

export type MetricFormat = "latency" | "rate" | "ratio" | "bytes" | "count" | "currency";

export interface MetricDef {
  key: string;
  label: string;
  format: MetricFormat;
}

export interface ServiceMetricGroup {
  service: string;
  label: string;
  /** CSS variable name for chart color, e.g. "--chart-1" */
  colorVar: string;
  metrics: MetricDef[];
}

export const METRIC_GROUPS: ServiceMetricGroup[] = [
  {
    service: "api-gateway",
    label: "API Gateway",
    colorVar: "--chart-1",
    metrics: [
      { key: "p95_latency", label: "P95 Latency", format: "latency" },
      { key: "request_rate", label: "Request Rate", format: "rate" },
      { key: "error_rate", label: "Error Rate", format: "rate" },
      { key: "active_connections", label: "Active Connections", format: "count" },
    ],
  },
  {
    service: "payment-service",
    label: "Payment Service",
    colorVar: "--chart-2",
    metrics: [
      { key: "p95_latency", label: "P95 Latency", format: "latency" },
      { key: "transaction_rate", label: "Transaction Rate", format: "rate" },
      { key: "failure_rate", label: "Failure Rate", format: "ratio" },
      { key: "pending_transactions", label: "Pending Txns", format: "count" },
      { key: "revenue_rate", label: "Revenue Rate", format: "currency" },
    ],
  },
  {
    service: "user-service",
    label: "User Service",
    colorVar: "--chart-3",
    metrics: [
      { key: "p95_latency", label: "P95 Latency", format: "latency" },
      { key: "auth_rate", label: "Auth Rate", format: "rate" },
      { key: "auth_failure_rate", label: "Auth Failures", format: "rate" },
      { key: "active_sessions", label: "Active Sessions", format: "count" },
      { key: "registration_rate", label: "Registrations", format: "rate" },
    ],
  },
  {
    service: "order-service",
    label: "Order Service",
    colorVar: "--chart-4",
    metrics: [
      { key: "p95_latency", label: "P95 Latency", format: "latency" },
      { key: "order_rate", label: "Order Rate", format: "rate" },
      { key: "queue_depth", label: "Queue Depth", format: "count" },
      { key: "error_rate", label: "Error Rate", format: "rate" },
    ],
  },
  {
    service: "redis-cache",
    label: "Redis Cache",
    colorVar: "--chart-5",
    metrics: [
      { key: "hit_ratio", label: "Hit Ratio", format: "ratio" },
      { key: "hits_rate", label: "Hits/s", format: "rate" },
      { key: "misses_rate", label: "Misses/s", format: "rate" },
      { key: "memory_used", label: "Memory Used", format: "bytes" },
      { key: "memory_max", label: "Memory Max", format: "bytes" },
      { key: "connected_clients", label: "Connected Clients", format: "count" },
      { key: "evicted_keys_rate", label: "Evicted Keys/s", format: "rate" },
      { key: "total_keys", label: "Total Keys", format: "count" },
    ],
  },
];

export function formatMetricValue(value: number, format: MetricFormat): string {
  switch (format) {
    case "latency":
      if (value >= 1) return `${value.toFixed(2)}s`;
      if (value >= 0.1) return `${(value * 1000).toFixed(0)}ms`;
      return `${(value * 1000).toFixed(1)}ms`;
    case "rate":
      if (value >= 100) return `${value.toFixed(0)}/s`;
      if (value >= 10) return `${value.toFixed(1)}/s`;
      return `${value.toFixed(3)}/s`;
    case "ratio":
      return `${(value * 100).toFixed(1)}%`;
    case "bytes":
      if (value >= 1_073_741_824) return `${(value / 1_073_741_824).toFixed(1)} GB`;
      if (value >= 1_048_576) return `${(value / 1_048_576).toFixed(1)} MB`;
      if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
      return `${value.toFixed(0)} B`;
    case "count":
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
      return value.toFixed(0);
    case "currency":
      return `$${value.toFixed(2)}/s`;
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/metric-registry.ts
git commit -m "feat: add frontend metric registry with formatters"
```

---

### Task 4: EventSource Consumer Hook

**Files:**
- Create: `frontend/src/hooks/use-metrics-stream.ts`

- [ ] **Step 1: Create the SSE consumer hook with circular buffer**

```typescript
// frontend/src/hooks/use-metrics-stream.ts
"use client";

import { useEffect, useRef, useCallback, useSyncExternalStore } from "react";

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
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/use-metrics-stream.ts
git commit -m "feat: add useMetricsStream hook with circular buffer"
```

---

### Task 5: Live Chart Component

**Files:**
- Create: `frontend/src/app/dashboard/_components/live-chart.tsx`

- [ ] **Step 1: Create the nivo line chart wrapper for streaming data**

```tsx
// frontend/src/app/dashboard/_components/live-chart.tsx
"use client";

import { useMemo } from "react";
import { ResponsiveLine } from "@nivo/line";
import type { StreamPoint } from "@/hooks/use-metrics-stream";
import type { MetricFormat } from "@/lib/metric-registry";
import { formatMetricValue } from "@/lib/metric-registry";
import { Card, CardContent } from "@/components/ui/card";
import { useTheme } from "next-themes";

interface LiveChartProps {
  label: string;
  metricKey: string;
  points: StreamPoint[];
  colorVar: string;
  format: MetricFormat;
}

function resolveColor(colorVar: string): string {
  if (typeof window === "undefined") return "#6366f1";
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(colorVar)
    .trim();
  return raw || "#6366f1";
}

export function LiveChart({ label, points, colorVar, format }: LiveChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const color = useMemo(() => resolveColor(colorVar), [colorVar, isDark]);

  const currentValue = points.length > 0 ? points[points.length - 1].value : null;
  const minValue = points.length > 0 ? Math.min(...points.map((p) => p.value)) : null;
  const maxValue = points.length > 0 ? Math.max(...points.map((p) => p.value)) : null;

  const nivoData = useMemo(
    () => [
      {
        id: label,
        data: points.map((p) => ({
          x: new Date(p.time),
          y: p.value,
        })),
      },
    ],
    [label, points],
  );

  const nivoTheme = useMemo(
    () => ({
      text: { fill: isDark ? "rgba(255,255,255,0.5)" : "rgba(0,0,0,0.5)" },
      axis: {
        ticks: {
          text: {
            fontSize: 10,
            fill: isDark ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.35)",
            fontFamily: "var(--font-mono)",
          },
        },
      },
      grid: { line: { stroke: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)" } },
      crosshair: { line: { stroke: color, strokeOpacity: 0.4 } },
    }),
    [isDark, color],
  );

  return (
    <Card className="h-full p-0">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[11px] tracking-[0.16em] text-muted-foreground uppercase">
            {label}
          </p>
          <p className="font-mono text-sm font-semibold tabular-nums text-foreground">
            {currentValue !== null ? formatMetricValue(currentValue, format) : "—"}
          </p>
        </div>

        <div className="mt-2 h-[170px]">
          {points.length >= 2 ? (
            <ResponsiveLine
              data={nivoData}
              margin={{ top: 4, right: 8, bottom: 24, left: 40 }}
              xScale={{ type: "time" }}
              yScale={{ type: "linear", min: "auto", max: "auto" }}
              axisBottom={{
                tickSize: 0,
                tickPadding: 6,
                format: "%H:%M:%S",
                tickValues: 4,
              }}
              axisLeft={{
                tickSize: 0,
                tickPadding: 6,
                tickValues: 4,
                format: (v) => formatMetricValue(Number(v), format),
              }}
              colors={[color]}
              lineWidth={2}
              enablePoints={false}
              enableArea
              areaOpacity={0.12}
              enableGridX={false}
              enableGridY
              motionConfig="gentle"
              theme={nivoTheme}
              enableCrosshair
              isInteractive
              useMesh
              tooltip={({ point }) => (
                <div className="border-border bg-popover px-2 py-1 font-mono text-[11px] text-popover-foreground shadow-md">
                  {formatMetricValue(Number(point.data.y), format)}
                </div>
              )}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="font-mono text-xs text-muted-foreground/40">
                Collecting samples…
              </span>
            </div>
          )}
        </div>

        {minValue !== null && maxValue !== null && (
          <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>min {formatMetricValue(minValue, format)}</span>
            <span>max {formatMetricValue(maxValue, format)}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/dashboard/_components/live-chart.tsx
git commit -m "feat: add LiveChart nivo component for streaming metrics"
```

---

### Task 6: Live Monitor Section Component

**Files:**
- Create: `frontend/src/app/dashboard/_components/live-monitor.tsx`

- [ ] **Step 1: Create the main live monitor section**

```tsx
// frontend/src/app/dashboard/_components/live-monitor.tsx
"use client";

import { motion } from "motion/react";
import { Radio, Wifi, WifiOff } from "lucide-react";
import { useMetricsStream } from "@/hooks/use-metrics-stream";
import { METRIC_GROUPS } from "@/lib/metric-registry";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { LiveChart } from "./live-chart";

const STATUS_CONFIG = {
  connecting: { label: "Connecting", icon: Wifi, className: "text-muted-foreground border-border" },
  live: { label: "Live", icon: Radio, className: "border-primary/20 bg-primary/10 text-primary" },
  error: { label: "Disconnected", icon: WifiOff, className: "border-destructive/20 bg-destructive/10 text-destructive" },
} as const;

export function LiveMonitor() {
  const { services, status } = useMetricsStream();
  const statusCfg = STATUS_CONFIG[status];
  const StatusIcon = statusCfg.icon;

  const totalMetrics = METRIC_GROUPS.reduce((sum, g) => sum + g.metrics.length, 0);

  return (
    <motion.section
      className="space-y-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <div className="flex items-end justify-between gap-3">
        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold tracking-tight">Live Monitor</h2>
          <p className="text-sm text-muted-foreground">
            Real-time Prometheus metrics · 2s refresh · 5m window
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="font-mono text-[11px] text-muted-foreground">
            {totalMetrics} metrics
          </div>
          <Badge
            variant="outline"
            className={cn("font-mono text-[11px]", statusCfg.className)}
          >
            <StatusIcon className="mr-1 h-3 w-3" />
            {statusCfg.label}
          </Badge>
        </div>
      </div>

      {METRIC_GROUPS.map((group, groupIdx) => {
        const serviceData = services[group.service] ?? {};
        return (
          <motion.div
            key={group.service}
            className="space-y-2"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 + groupIdx * 0.06 }}
          >
            <h3 className="font-mono text-xs tracking-[0.16em] text-muted-foreground uppercase sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-1">
              {group.label}
            </h3>
            <div className="grid gap-3 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              {group.metrics.map((metric) => (
                <LiveChart
                  key={`${group.service}-${metric.key}`}
                  label={metric.label}
                  metricKey={metric.key}
                  points={serviceData[metric.key] ?? []}
                  colorVar={group.colorVar}
                  format={metric.format}
                />
              ))}
            </div>
          </motion.div>
        );
      })}
    </motion.section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/dashboard/_components/live-monitor.tsx
git commit -m "feat: add LiveMonitor section with service-grouped chart grid"
```

---

### Task 7: Integrate Live Monitor into Dashboard Page

**Files:**
- Modify: `frontend/src/app/dashboard/page.tsx`

- [ ] **Step 1: Add LiveMonitor below existing sparklines**

Add import and component at the bottom of the page. The existing sparkline cards remain untouched.

```tsx
// Add import at top:
import { LiveMonitor } from "./_components/live-monitor";

// Add after the closing </div> of the sparkline grid (before the final closing </div>):
<LiveMonitor />
```

The full updated return should be:

```tsx
return (
  <div className="space-y-4">
    <motion.div
      className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between"
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* ... existing header unchanged ... */}
    </motion.div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {/* ... existing SERVICES.map unchanged ... */}
    </div>

    <LiveMonitor />
  </div>
);
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm typecheck`
Expected: No errors

- [ ] **Step 3: Verify dev server renders the page**

Run: `cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm dev`
Open: `http://localhost:3001/dashboard`
Expected: Existing sparkline cards at top, Live Monitor section below with "Connecting" badge that transitions to "Live" when backend is running. Charts show "Collecting samples…" initially, then populate with streaming data.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/dashboard/page.tsx
git commit -m "feat: integrate LiveMonitor into dashboard page"
```

---

### Task 8: Final Verification

- [ ] **Step 1: Start full stack**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && docker compose up -d
```

Wait for services to be healthy.

- [ ] **Step 2: Start backend**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai && uvicorn api_backend.app:app --host 0.0.0.0 --port 8090 --reload
```

- [ ] **Step 3: Start frontend**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm dev
```

- [ ] **Step 4: Verify in browser**

Open `http://localhost:3001/dashboard`:
1. Existing sparkline cards render at top — unchanged
2. "Live Monitor" section appears below with "Live" badge
3. 26 charts grouped by service, each populating with data points
4. Data slides in every ~2 seconds
5. Charts show smooth animation via nivo `motionConfig="gentle"`
6. Min/max footer values update as data accumulates
7. Current value displays in top-right of each chart

- [ ] **Step 5: Test error recovery**

Stop the backend (`Ctrl+C`). Badge should change to "Disconnected". Restart backend — EventSource auto-reconnects, badge returns to "Live", data resumes.

- [ ] **Step 6: Run linter and typecheck**

```bash
cd /Users/exx0dus/GitHub/PJATK-s28476/infrawatch-ai/frontend && pnpm lint && pnpm typecheck
```

Expected: No errors.
