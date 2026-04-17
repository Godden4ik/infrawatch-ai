# Live Monitoring Dashboard — Design Spec

**Date:** 2026-04-17
**Route:** `/dashboard` (enhancement)
**Pattern:** C — Hybrid (stats + detail)

## Overview

Enhance the existing `/dashboard` page with a real-time streaming monitoring section below the current sparkline cards. Server-sent events (SSE) push all Prometheus metrics from the backend every 2 seconds. Frontend maintains circular buffers and renders nivo time-series charts in a dense scrollable grid grouped by service.

## Requirements

- Keep existing sparkline cards unchanged at top of page
- Add "Live Monitor" section below with streaming nivo charts
- 5-minute sliding window, 2-second update interval
- All ~26 Prometheus metrics across 5 services
- Grouped by service, single scrollable grid
- Visible data points sliding in — real-time heartbeat feel

## Architecture

### Backend: SSE Endpoint

**New route:** `GET /api/metrics/stream` in `api_backend/routes/metrics_stream.py`

- Async generator loop every 2s
- Each tick: parallel `httpx.AsyncClient` requests to Prometheus `query` endpoint for all 26 metrics
- Emits single SSE event per tick with all metric values batched:

```
event: metrics
data: {"timestamp":"2026-04-17T12:00:00Z","services":{"api-gateway":{"gateway_request_duration_p95":0.089,"gateway_requests_rate":12.4,...},...}}
```

- On client disconnect, loop terminates
- SSE `retry: 3000` for auto-reconnect

### Frontend: SSE Proxy

**New route:** `frontend/src/app/api/metrics/stream/route.ts`

- Proxies SSE from backend `http://localhost:8090/api/metrics/stream` to client
- Streams response directly (same pattern as pipeline SSE proxy)

### Frontend: Data Consumer Hook

**New hook:** `frontend/src/hooks/use-metrics-stream.ts`

- Opens `EventSource` to `/api/metrics/stream`
- Maintains `Map<string, Map<string, MetricPoint[]>>` — service → metric → points
- Circular buffer: max 150 points per metric (~5min at 2s)
- Single `setState` per SSE event batch (not per metric)
- Exposes: `{ services: Record<string, Record<string, MetricPoint[]>>, status: 'connecting' | 'live' | 'error' }`
- Native `EventSource` auto-reconnection

### Frontend: Chart Components

**`live-monitor.tsx`** — Main section:
- Section header: "Live Monitor" + connection status badge + metric count
- Scrollable grid grouped by service
- Service name as sticky sub-header
- Within each service: `grid-cols-1 md:grid-cols-2 xl:grid-cols-3`

**`live-chart.tsx`** — Single chart:
- nivo `ResponsiveLine`, `h-[200px]`, Card wrapper
- `motionConfig="gentle"` for smooth transitions
- X axis: time (HH:mm:ss), Y axis: auto-scaled
- Area fill with gradient, no point dots
- Metric label, current value, min/max in footer
- Colors: `--chart-1` through `--chart-5`, one per service group

### Metric Registry

**New file:** `frontend/src/lib/metric-registry.ts`

Maps each metric to: display name, service, format function, color. Single source of truth for frontend display config.

| Service | Metric | PromQL | Format |
|---------|--------|--------|--------|
| **api-gateway** | P95 Latency | `histogram_quantile(0.95, gateway_request_duration_seconds_bucket)` | ms/s |
| | Request Rate | `rate(gateway_requests_total[30s])` | /s |
| | Error Rate | `rate(gateway_requests_total{status="5xx"}[30s])` | /s |
| | Active Connections | `gateway_active_connections` | count |
| **payment-service** | P95 Latency | `histogram_quantile(0.95, payment_processing_duration_seconds_bucket)` | ms/s |
| | Transaction Rate | `rate(payment_transactions_total[30s])` | /s |
| | Failure Rate | `payment_failure_rate` | ratio |
| | Pending Txns | `payment_pending_transactions` | count |
| | Revenue | `rate(payment_revenue_dollars_total[30s])` | $/s |
| **user-service** | P95 Latency | `histogram_quantile(0.95, user_request_duration_seconds_bucket)` | ms/s |
| | Auth Rate | `rate(user_auth_attempts_total[30s])` | /s |
| | Auth Failures | `rate(user_auth_attempts_total{result="failure"}[30s])` | /s |
| | Active Sessions | `user_active_sessions` | count |
| | Registrations | `rate(user_registrations_total[30s])` | /s |
| **order-service** | P95 Latency | `histogram_quantile(0.95, order_processing_duration_seconds_bucket)` | ms/s |
| | Order Rate | `rate(order_processed_total[30s])` | /s |
| | Queue Depth | `order_queue_depth` | count |
| | Error Rate | `rate(order_errors_total[30s])` | /s |
| **redis-cache** | Hit Ratio | `redis_cache_hit_ratio` | % |
| | Hits/s | `rate(redis_cache_hits_total[30s])` | /s |
| | Misses/s | `rate(redis_cache_misses_total[30s])` | /s |
| | Memory Used | `redis_memory_used_bytes` | bytes |
| | Memory Max | `redis_memory_max_bytes` | bytes |
| | Connected Clients | `redis_connected_clients` | count |
| | Evicted Keys | `rate(redis_evicted_keys_total[30s])` | /s |
| | Total Keys | `redis_keys_total` | count |

Rate queries use `[30s]` window for fast-reacting values matching 2s cadence.

Backend mirrors this registry as a Python dict for PromQL definitions.

## File Changes

### New Files

| File | Purpose |
|------|---------|
| `api_backend/routes/metrics_stream.py` | SSE endpoint — polls Prometheus, emits batched events |
| `frontend/src/app/api/metrics/stream/route.ts` | Next.js SSE proxy |
| `frontend/src/hooks/use-metrics-stream.ts` | EventSource consumer + circular buffer |
| `frontend/src/lib/metric-registry.ts` | Display names, format functions, colors per metric |
| `frontend/src/app/dashboard/_components/live-monitor.tsx` | Main live section — service groups + chart grid |
| `frontend/src/app/dashboard/_components/live-chart.tsx` | Single nivo streaming chart |

### Modified Files

| File | Change |
|------|--------|
| `api_backend/app.py` | Register metrics stream router |
| `frontend/src/app/dashboard/page.tsx` | Add LiveMonitor below sparklines |

### Unchanged

Existing sparkline cards, service-metrics, metric-chart, schemas, query-options — all untouched.
