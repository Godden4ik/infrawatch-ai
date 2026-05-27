# Frontend AGENTS.md

Frontend-local build rules for `frontend/`. Based on `salon-svitlo-crm` patterns, adapted to Next.js 16 + React 19 + TanStack Query + shadcn/ui.

## Skill Usage — Mandatory

| Working on | Load/read first |
|------------|-----------------|
| Any new page or UI surface | `docs/patterns/page-layout.md`. Pick pattern `B`, `C`, or `D`. State it in plan. |
| Any `src/components/ui/` or shared UI change | Audit existing primitive first. Extend variant before creating new file. |
| Any route shell, page chrome, or navigation change | Reuse shared shell primitives in `src/components/layout/` before inventing new chrome. |
| Any topology graph change | Follow `docs/patterns/page-layout.md` Topology standards exactly. |

Do not use one-off marketing layouts. Frontend follows dense monitoring UI patterns, not bespoke hero design.

## Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 App Router |
| UI | React 19 |
| Server state | TanStack Query v5 |
| URL state | nuqs |
| Validation | Zod |
| Styling | Tailwind CSS v4 + semantic tokens |
| UI primitives | shadcn/Base UI in `src/components/ui/` |
| Animations | `motion/react` |
| Charts | nivo only |
| Graph | `@xyflow/react` |
| Package manager | pnpm |

## Architecture

### Key conventions

- Import alias: `@/` → `src/`
- UI primitives live in `src/components/ui/`
- Layout/shared shell lives in `src/components/layout/`
- Domain composites live in page `_components/` or `src/components/`
- Services use `src/services/{domain}/schema.ts`, `query-options.ts`, `actions.ts`
- Client talks to backend through Next API proxies only. No direct browser calls to backend service URLs.
- TanStack Query is sole server cache. No Next cache tags, ISR, or `revalidateTag`.
- Server state in TanStack Query, URL state in nuqs, ephemeral UI state in React state.

## Component Reuse — Mandatory

Never create inline/ad-hoc UI when reusable primitive exists. Compose from shared layers.

```
Layer 1: src/components/ui/        — shadcn/Base UI primitives
Layer 2: src/components/layout/    — app shell, breadcrumbs, nav, shared chrome
Layer 3: src/app/**/_components/   — domain/page-specific compositions
```

Rules:

1. Before creating any component, search `src/components/ui/` and `src/components/layout/`.
2. Extend primitive with variant before forking visual pattern.
3. Domain components compose shared primitives. Avoid raw `div` wrappers that duplicate `Card`, `Badge`, `Button`, `Tabs`, `Sidebar`, `Skeleton`.
4. Empty/loading/error states should use shared primitives or extract one if pattern repeats.
5. If JSX could be reused by another page, extract it immediately.

## Building Pages — Mandatory

Every page must fit one layout pattern from `docs/patterns/page-layout.md`.

| Pattern | Use when | Current routes |
|---------|----------|----------------|
| `B — Bento` | Heterogeneous widgets | `/`, `/anomaly` |
| `C — Hybrid` | Stats + main detail area | `/dashboard`, `/evaluation`, `/providers` |
| `D — Split-pane` | Controls/list + output/detail | `/pipeline`, `/topology` |

Composition law:

1. Border/shadow container → `Card`. Never raw `rounded-xl border`.
2. Stats → dedicated stat card pattern. Never inline number tiles.
3. Charts → nivo in fixed-height area only.
4. Page title/description belong to route shell, not nested cards.
5. No card-in-card unless primitive explicitly designed for it.
6. Dense spacing only: `p-3` stat cards, `p-4` content cards, `gap-3` cards, `gap-4` sections.
7. Route shell owns tabs, breadcrumbs, and major chrome.

## Styling Rules — Mandatory

- Semantic tokens only: `bg-card`, `text-foreground`, `border-border`, `text-muted-foreground`.
- No raw palette classes like `bg-slate-900`, `text-blue-400`, hex literals, or arbitrary colors inside app UI unless graph/canvas library forces inline styles.
- Industrial radius: structural elements stay sharp. Prefer token radius or `rounded-sm`. Avoid `rounded-lg`, `rounded-xl`, pills on shell chrome.
- Monitoring density: labels `text-xs`, body `text-sm`, headings `text-base`, stat values `text-2xl font-semibold tabular-nums`.
- Page chrome should feel shadcn/supabase: dark shell, quiet borders, monospace metadata, restrained accent.

## Route Tabs — Supabase Style

For top-level monitoring navigation:

- Use five core tabs: `Overview`, `Service Health`, `Anomaly`, `Pipeline`, `Topology`
- Tabs are compact, rectangular, dark-surface, border-defined.
- Active tab gets brighter foreground, inset surface, stronger border.
- Inactive tabs stay muted with subtle hover only.
- No pill tabs, no rounded-full, no glossy gradients.

Secondary pages like `Evaluation` and `Providers` can stay accessible via sidebar/breadcrumbs until promoted to core nav.

## Topology Standards — Mandatory

- Pattern `D` split-pane.
- Orthogonal edges only. No smooth curves.
- Dotted stroke with moving dash animation to imply flow direction.
- Industrial nodes: dark card surface, sharp corners, monospace labels, small status dot.
- Minimal controls: zoom + fit. No minimap.
- Blast radius state must visually intensify nodes/edges with destructive accent.

## Migration Guardrails

- Match existing app language: monitoring dashboard, not CRM, not marketing site.
- Preserve user changes in dirty worktree. Do not revert unrelated edits.
- When modernizing a page, migrate shell and primitives first, data flow second, visuals third.
- If graph or chart library needs inline style values, source color from CSS variables where possible.

## Color Tokens — Mandatory

Use semantic tokens. Never use raw palette classes (`bg-emerald-500`, `text-red-400`, etc.) inside app UI. Authoritative tokens live in `src/app/globals.css`.

### Status tokens (severity)

| Token | Meaning | Tailwind classes (examples) |
|-------|---------|------------------------------|
| `--status-healthy` | Service / signal nominal | `bg-status-healthy`, `text-status-healthy`, `bg-status-healthy-soft` |
| `--status-degraded` | Warning, partial degradation | `bg-status-degraded`, `text-status-degraded`, `bg-status-degraded-soft` |
| `--status-critical` | Failure, outage, error | `bg-status-critical`, `text-status-critical`, `bg-status-critical-soft` |
| `--status-unknown` | Unreachable / no signal | `bg-status-unknown`, `text-status-unknown`, `bg-status-unknown-soft` |

`-soft` variants are pre-faded (14–16% alpha) for backgrounds. `border-status-*/20` etc. supported via slash opacity.

### Brand tokens (identity)

| Token | Meaning | Tailwind classes (examples) |
|-------|---------|------------------------------|
| `--brand` | Electric violet ~290° — InfraWatch accent | `bg-brand`, `text-brand`, `border-brand`, `bg-brand-soft` |
| `--brand-soft` | Brand at low alpha for surfaces | `bg-brand-soft` |
| `--brand-glow` | Brand at mid alpha for outer glow | inline `shadow-[0_0_18px_var(--brand-glow)]` |
| `--primary` | Aliased to `--brand` | `bg-primary` resolves to brand |

Brand is reserved for: active route indicator, primary CTA, focus rings, selected state in graphs, AI/agent affordances (LLM provider badges, streaming cursor).

### Severity mapping reference

When a domain status maps to severity:

| Domain term | Use |
|-------------|-----|
| `healthy`, `nominal`, `online` | `healthy` |
| `unhealthy`, `warn`, `degraded` | `degraded` |
| `unreachable`, `down`, `error`, `failed` | `critical` |
| `unknown`, missing data | `unknown` |

## Motion Rules

Library: `motion/react`. Variants live in `src/lib/motion-variants.ts`.

| Variant | Intent | Where to use |
|---------|--------|--------------|
| `fadeInUp` | Subtle entrance, 2px lift + opacity, 180ms | Page sections, cards on mount via stagger |
| `staggerContainer` | Parent of `fadeInUp` items, 20ms stagger / 30ms delay | `<PageMount>` |

Contract:

- All motion must read `useReducedMotion()` from `motion/react` and short-circuit when reduced.
- No motion on live data values (latency, rate, error counters that change every 2s). Use crossfade or no animation.
- Use `<AnimatedNumber>` for **stable** counters only (services online total, configured providers, pipeline runs today).
- Never animate layout (height/width) in monitoring chrome. Transforms only.
- No staggered entrance on `/topology` graph nodes — XYFlow owns that surface.

## View Transition Naming Conventions

Browser `view-transition-name` is reserved at three levels:

| Name | Owner | Purpose |
|------|-------|---------|
| `header-shell` | `app/layout.tsx` — `<header>` | Persistent header chrome across navs |
| `system-status` | `app/layout.tsx` — System Online pill | Anchors status indicator |
| `active-tab-indicator` | `components/layout/core-route-tabs.tsx` — active tab inner span | Sliding indicator morph |
| `node-${serviceId}` | `app/page.tsx` `ServiceCard`, `app/dashboard/page.tsx` per-service motion div, `app/topology/_components/topology-node.tsx` | Cross-page shared-element morph between health card and graph node |

Rules:

- Names must be **globally unique within a rendered DOM snapshot**. Don't reuse `node-api-gateway` on the same page.
- Cross-page morph is automatic when both pages render the same name. Mismatched pages fall back to root crossfade — that's fine.
- Next.js `experimental.viewTransition: true` is enabled (`next.config.mjs`). Routing wraps in `document.startViewTransition` automatically.
- New names require a row added to this table.

## Component Composition Table

Beyond the layers already documented, the following project-local primitives exist:

| Primitive | Location | Purpose |
|-----------|----------|---------|
| `StatusDot`, `StatusPill`, `StatusBar` | `components/ui/status-indicator.tsx` | Severity-driven indicators. Variants: `healthy` / `degraded` / `critical` / `unknown`. |
| `AnimatedNumber` | `components/ui/animated-number.tsx` | Motion-eased count-up for stable counters. Respects reduced motion. |
| `PageMount` | `components/layout/page-mount.tsx` | Wraps page root, staggers direct children fade-in on mount. Pass `className` for layout (`space-y-4`, `grid grid-cols-3`, etc.). |
| `Card` (with `tone`) | `components/ui/card.tsx` | `tone="default" | "brand" | "critical" | "degraded" | "healthy"` — adjusts ring color + top-edge accent stroke. |

## Stack Additions

Add to the existing Stack table:

| Layer | Technology |
|-------|-----------|
| View transitions | Next.js `experimental.viewTransition` (React 19 `<ViewTransition>` integration) |
