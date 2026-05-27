# Design: InfraWatch UI Color + Professionality Pass

**Date**: 2026-05-27
**Branch**: `feature/view-transitions`
**Status**: Approved
**Author**: Tymur + Claude

## Context

Frontend (`frontend/`) is a dense, dark, supabase-styled monitoring UI on Next.js 16 + React 19 + Tailwind v4 + shadcn (`base-lyra` preset). Semantic tokens already exist: `--background`, `--card`, `--border`, `--muted`, `--primary`, `--accent`, and a metric scale `--metric-{latency,rate,error,warning,success}` with `-soft` 14–16% alpha variants. The metric scale is underused — most pages use generic neutral surfaces, and severity is communicated through text rather than color. `--primary` is a generic blue (oklch ≈ 0.55 0.199 265°) with no identity.

In flight on this branch: CSS view-transition crossfade + sliding active-tab indicator (`active-tab-indicator`, `header-shell`, `system-status` named elements). Goal of this pass: bring more identity and meaning to color while keeping monitoring density. No marketing aesthetic.

## Goals

1. **Severity color system** pervasively wired across pages via dedicated `--status-*` aliases.
2. **Brand identity**: electric violet (~290°) as the InfraWatch accent — distinct from every metric color.
3. **Surface polish**: refined `Card` strokes, typography lockdown, depth via inset highlights.
4. **Motion choreography**: stagger entrance per page, count-up on stable counters, attention pulse on active anomalies — all respecting `prefers-reduced-motion`.
5. **Cross-page view-transition anchoring** between `/dashboard` service cards and `/topology` service nodes via shared `view-transition-name`.
6. **AGENTS.md consolidation**: single canonical pattern doc; `CLAUDE.md` becomes a symlink at both frontend and repo root.

## Non-goals

- Marketing-style hero treatments, gradient banners, glossy CTAs.
- Raw palette classes (`bg-slate-500`, hex literals) anywhere in app UI.
- Density loss — `p-3` / `p-4` / `text-xs` rules from `frontend/AGENTS.md` stay.
- Light-mode polish beyond mirroring tokens (dark is primary).
- New shadcn primitive additions; only project-local primitives.
- Chart visual overhaul. Nivo consumes new tokens, nothing else.

## Token system

### `frontend/src/app/globals.css` additions

```css
.dark {
  /* Brand */
  --brand: oklch(0.66 0.21 290);
  --brand-foreground: oklch(0.985 0 0);
  --brand-soft: oklch(0.66 0.21 290 / 0.14);
  --brand-glow: oklch(0.66 0.21 290 / 0.35);

  /* Re-aim primary + ring at brand */
  --primary: var(--brand);
  --ring: oklch(0.66 0.21 290 / 0.6);

  /* Status aliases (semantic layer over the metric palette) */
  --status-healthy: var(--metric-success);
  --status-healthy-soft: var(--metric-success-soft);
  --status-degraded: var(--metric-warning);
  --status-degraded-soft: var(--metric-warning-soft);
  --status-critical: var(--metric-error);
  --status-critical-soft: var(--metric-error-soft);
  --status-unknown: oklch(0.55 0.02 285);
  --status-unknown-soft: oklch(0.55 0.02 285 / 0.14);
}

:root {
  /* Light-mode mirrors with appropriate adjustments */
  --brand: oklch(0.58 0.22 290);
  --brand-foreground: oklch(0.985 0 0);
  --brand-soft: oklch(0.58 0.22 290 / 0.12);
  --brand-glow: oklch(0.58 0.22 290 / 0.28);
  --primary: var(--brand);
  --ring: oklch(0.58 0.22 290 / 0.55);

  --status-healthy: var(--metric-success);
  --status-healthy-soft: var(--metric-success-soft);
  --status-degraded: var(--metric-warning);
  --status-degraded-soft: var(--metric-warning-soft);
  --status-critical: var(--metric-error);
  --status-critical-soft: var(--metric-error-soft);
  --status-unknown: oklch(0.6 0.02 285);
  --status-unknown-soft: oklch(0.6 0.02 285 / 0.1);
}

@theme inline {
  --color-brand: var(--brand);
  --color-brand-foreground: var(--brand-foreground);
  --color-brand-soft: var(--brand-soft);
  --color-status-healthy: var(--status-healthy);
  --color-status-healthy-soft: var(--status-healthy-soft);
  --color-status-degraded: var(--status-degraded);
  --color-status-degraded-soft: var(--status-degraded-soft);
  --color-status-critical: var(--status-critical);
  --color-status-critical-soft: var(--status-critical-soft);
  --color-status-unknown: var(--status-unknown);
}
```

Result: `bg-brand`, `text-brand`, `border-brand`, `bg-brand-soft`, `text-status-healthy`, `border-status-critical`, etc. all usable.

## Next.js view transition integration

Enable React's `<ViewTransition>` integration in `frontend/next.config.mjs`:

```js
const nextConfig = {
  output: "standalone",
  experimental: { viewTransition: true },
}
```

This causes Next.js to handle the snapshot timing on route navigation, removing the need for the `rAF × 2` hack in `ViewTransitionLink`. The wrapper component is simplified to a plain re-export of `next/link` (kept for naming consistency / future extension), or removed entirely. CSS `view-transition-name` styles and `::view-transition-old/new(root)` keyframes already in `globals.css` continue to apply.

If the experimental flag turns out to be unstable in Next.js 16.1.7 (the project's pinned version — docs are at 16.2.6), revert to keeping the explicit `document.startViewTransition` wrapper. Verification step in browser will determine which path ships.

## New primitives

### `frontend/src/components/ui/status-indicator.tsx`

```tsx
type Variant = "healthy" | "degraded" | "critical" | "unknown"

<StatusPill variant pulse?> {label}      // small badge with dot + label
<StatusDot variant pulse? />              // just the dot (header status, breadcrumb)
<StatusBar variant />                     // left-edge accent stripe for cards/nodes
```

Tokens consumed: `--status-{variant}` for foreground, `--status-{variant}-soft` for background. `pulse` toggles a 2s ease-in-out opacity loop on the dot.

Replaces existing one-off `bg-emerald-500 animate-ping` and similar inline severity colorings.

### `frontend/src/components/ui/animated-number.tsx`

```tsx
<AnimatedNumber value={count} format?={(n) => string} duration?={350} />
```

motion/react `useSpring` or `useMotionValue` interpolation between previous and current `value`. `tabular-nums` enforced. Only for **stable** counters (services online, configured providers, pipeline runs today). Not for live latency / rate values — those would jitter and feel slow.

### `frontend/src/components/layout/page-mount.tsx`

```tsx
<PageMount>{children}</PageMount>
```

Wraps page content in a motion/react `motion.div` configured as a `staggerContainer`. Direct children stagger-fade-rise with 60ms `delayChildren`, 40ms `staggerChildren`, 220ms `duration`, 4px translateY. Reads `prefers-reduced-motion` via `useReducedMotion()` from motion/react — disables stagger and renders static when reduced.

### `frontend/src/lib/motion-variants.ts`

Single source of truth for motion variant objects:

- `fadeInUp` — `{ hidden: { opacity: 0, y: 4 }, visible: { opacity: 1, y: 0 } }`
- `staggerContainer` — `{ hidden: {}, visible: { transition: { staggerChildren: 0.04, delayChildren: 0.06 } } }`
- `attentionPulse` — keyframe object scaling 1.0 → 1.005 → 1.0 over 6s, infinite. Applied only when an anomaly is `isActive=true`.

## Surface polish

### `Card` refinement

Existing `Card` primitive (in `frontend/src/components/ui/`) gets:

1. `position: relative; isolation: isolate;` if not already.
2. Pseudo-element overlay:
   ```css
   ::after {
     content: "";
     position: absolute; inset: 0;
     border-radius: inherit;
     padding: 1px;
     background: linear-gradient(135deg, var(--brand-soft), transparent 60%);
     mask: linear-gradient(#000, #000) content-box, linear-gradient(#000, #000);
     mask-composite: exclude;
     opacity: 0.4;
     pointer-events: none;
   }
   ```
3. Inset highlight via existing classes: `shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]`.
4. New variant `tone="critical"` swaps the gradient to `--status-critical-soft`; `tone="brand"` keeps default but opacity 0.65. Default tone unchanged for most surfaces.

### Typography lockdown

Codify in `frontend/AGENTS.md`:

- Stat values: `text-2xl font-semibold tabular-nums tracking-tight text-foreground`
- Labels: `text-[10px] font-mono uppercase tracking-[0.14em] text-muted-foreground/80`
- Headings: `text-base font-semibold` (sections), `text-sm font-medium` (cards)
- Body: `text-sm`
- Metadata: `text-xs font-mono text-muted-foreground/70`

## Per-page choreography

| Route | Treatment |
|-------|-----------|
| `/` | `<PageMount>`. Stat row + microservices grid + infrastructure grid stagger. Header `System Online` pill: violet glow when healthy via `bg-brand-soft` + `text-brand`. Stat values → `<AnimatedNumber>`. |
| `/dashboard` | Stat row stagger. Each sparkline card gets `<StatusBar>` left edge driven by health. Live Monitor section unchanged (live data churn does not need entrance motion). |
| `/anomaly` | Anomaly cards: `attentionPulse` when `isActive`, `<StatusBar variant="critical">` accent. Inject form button: `hover:shadow-[0_0_20px_var(--brand-glow)]`. |
| `/pipeline` | Stage badges colored by status: `idle=muted`, `running=brand`, `complete=healthy`. Launch button: brand. Streaming token cursor: `text-brand` with brand-glow box-shadow. |
| `/topology` | Service nodes: 3px left status bar driven by health from telemetry. Selected node: `ring-2 ring-brand`. Blast-radius affected nodes: status-critical stroke; affected edges: thicken + status-critical stroke. |
| `/evaluation` | GraphRAG side: header strip `border-l-2 border-brand`. Naive side neutral. Win/loss outcome badges: `<StatusPill>`. |
| `/providers` | Provider cards: status-driven outer border (healthy / missing-key=degraded / error=critical). Active provider: `border-l-2 border-brand` stripe. |

## Cross-page view transition: topology nodes ↔ dashboard cards

Each service shared between `/dashboard` and `/topology` is identified by `serviceId` (`api-gateway`, `payment-service`, `user-service`, `order-service`, `redis-cache`).

- On `/dashboard`, each sparkline card wrapper gets `style={{ viewTransitionName: \`node-${serviceId}\` }}`.
- On `/topology`, each XYFlow node renderer outer wrapper gets the same `viewTransitionName`.

Result: navigating from `/dashboard` to `/topology` (and back) morphs the matching elements from card position → node position via shared-element transitions. Other elements crossfade as part of root.

Caveats:
- Names must be unique within each rendered DOM snapshot. Five services = five distinct names per page. No collisions.
- If a node is not visible on `/topology` due to virtualization or filtering, that pairing simply doesn't morph; the card crossfades as root. Acceptable degradation.
- View Transitions API must be supported — already feature-detected by `ViewTransitionLink` / Next.js integration.

## AGENTS.md consolidation

Append to `frontend/AGENTS.md` new sections:

1. **Color Tokens** — table of `--brand-*` and `--status-*` tokens with intended use.
2. **Motion Rules** — when to use `fadeInUp` vs `attentionPulse`; reduced-motion contract; never block interaction.
3. **View Transition Naming Conventions** — reserved names: `header-shell`, `system-status`, `active-tab-indicator`, `node-${serviceId}`. New names require AGENTS.md addition.
4. **Component Composition Table** — update with `StatusPill`, `StatusDot`, `StatusBar`, `AnimatedNumber`, `PageMount`.
5. Reinforce that `docs/patterns/page-layout.md` is authoritative for page patterns B / C / D — keep it referenced, don't inline its full content.

Existing sections (Skill Usage, Stack, Architecture, Building Pages, Styling Rules, Route Tabs, Topology Standards, Migration Guardrails) preserved as-is.

## Symlinks

```bash
# Frontend-local
rm frontend/CLAUDE.md
ln -s AGENTS.md frontend/CLAUDE.md

# Repo root: create AGENTS.md from CLAUDE.md, then symlink
mv CLAUDE.md AGENTS.md
ln -s AGENTS.md CLAUDE.md
```

The frontend-level pair and the root-level pair are independent: frontend AGENTS.md remains the dense frontend-specific build doc; root AGENTS.md remains the project-wide overview (Architecture, Tech Stack, Phase Status, MCP env vars, etc.). Both have CLAUDE.md as a symlink so Claude Code reads them automatically.

## Implementation order (single PR, phased commits)

1. **Token system** — `globals.css` additions, `@theme inline` exports.
2. **Next.js integration** — `experimental.viewTransition: true`, simplify `ViewTransitionLink` to a re-export (or remove if route nav auto-wraps).
3. **Primitives** — `StatusIndicator`, `AnimatedNumber`, `PageMount`, `motion-variants`.
4. **Surface polish** — `Card` gradient stroke, typography classes documented.
5. **Per-page wiring** — one commit per route. Severity colors + motion choreography + brand accents.
6. **Topology cross-page anchoring** — view-transition-names on `/dashboard` cards and `/topology` nodes.
7. **AGENTS.md consolidation** — append new sections.
8. **Symlinks** — both frontend and root.

## Verification

- `pnpm typecheck` — zero errors.
- `pnpm lint` — zero errors; pre-existing `SelectValue` warning unrelated.
- Browser walkthrough via `chrome-devtools-mcp`:
  - All 8 routes render without errors.
  - Page-mount stagger fires once per route entry, not on every state update.
  - View-transitions still slide active-tab indicator and anchor header.
  - Cross-page morph between `/dashboard` cards and `/topology` nodes fires.
  - Toggle `prefers-reduced-motion: reduce` in DevTools rendering panel; verify no entrance motion, no attention pulse, but view transitions reduce to fade per existing CSS guard.

## Risks

- **Experimental flag stability** on Next.js 16.1.7: docs cover 16.2.6; older minor may not have the integration fully wired. Fallback: keep `ViewTransitionLink` with the rAF×2 hack.
- **Cross-page morph performance** with 5 simultaneous shared-element transitions: should be GPU-cheap, but degraded devices may stutter. The existing CSS reduced-motion guard kills the keyframe animations; the transform morph itself is browser-native.
- **Surface gradient stroke** may interact with existing inline `border-l-2` accents on certain cards — verify per page during wiring.

## Out of scope

- Adding new shadcn primitives from registry.
- Chart restyling beyond palette refresh.
- Light-mode visual review.
- Mobile-specific tweaks.
- Backend / API / scoring code changes.
