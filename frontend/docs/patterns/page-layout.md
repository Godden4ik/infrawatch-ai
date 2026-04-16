# InfraWatch AI — Page Layout Patterns

Every page MUST fit one of these patterns. Pattern chosen before coding.

Adapted from Salon Svitlo CRM architecture guidelines.

---

## Page Map

| Page | Route | Pattern | Description |
|------|-------|---------|-------------|
| Overview | `/` | **B — Bento** | Service health cards, connectivity status, system stats |
| Service Health | `/dashboard` | **C — Hybrid** | Stat cards + nivo time-series charts per service |
| Anomaly Injection | `/anomaly` | **B — Bento** | Scenario buttons + inject form + active anomalies |
| Agent Pipeline | `/pipeline` | **D — Split-pane** | Controls sidebar + streaming agent output |
| Topology | `/topology` | **B — Bento** | Interactive graph + blast radius panel |
| RAG Evaluation | `/evaluation` | **C — Hybrid** | Query form + comparison charts + results |

---

## Composition Law (all patterns)

1. **Containers with border/shadow → `Card`.** Never `rounded-xl border border-border bg-card`.
2. **Stats → semantic stat cards.** Never raw div with number + label.
3. **Charts → nivo inside fixed-height containers.** Always `ResponsiveLine`, `ResponsiveBar`, etc.
4. **Provider selectors → `<ProviderSelector>`.** Never inline provider pills.
5. **No card-in-card.** If you need sub-sections, use headings inside a Card.
6. **Semantic tokens only.** `text-foreground`, `bg-card`, `border-border`. Never raw colors.
7. **Dense layout.** This is a monitoring tool, not a marketing site. Minimize whitespace.

---

## Pattern B — Bento (Dashboard)

Use for: heterogeneous widgets, no single list dominates.

```
Page
├── Page header (title + description + actions)
├── Stat row (grid of metric cards)
├── Widget grid (charts, status cards, lists)
└── Optional: embedded table section
```

Rules:
- `gap-3` between cards in grid, `gap-4` between sections
- Cards use consistent heights per row (`min-h-[...]`)
- Responsive: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3`
- Charts get fixed container height (never auto-height)

---

## Pattern C — Hybrid (Stats + Detail)

Use for: one main content area with context stats above.

```
Page
├── Page header
├── Stat row (2-4 context cards)
└── Main content (charts grid / comparison / detail)
```

---

## Pattern D — Split-pane

Use for: controls + output, thread browsing.

```
Page (grid: sidebar + main)
├── Sidebar (controls, filters, selections)
└── Main pane (output, detail, visualization)
```

Rules:
- Sidebar: fixed width (`300px` or `w-[300px]`)
- Main pane: `flex-1`
- No stacking on mobile — sidebar collapses or becomes top bar

---

## Design Density Rules

InfraWatch is a monitoring tool. Every pixel should earn its place.

1. **Card padding**: `p-3` for stat cards, `p-4` for content cards. Never `p-6` or `p-8`.
2. **Section gaps**: `gap-3` between cards, `gap-4` between major sections. Never `gap-6` or larger.
3. **Font sizes**: `text-xs` for labels/metadata, `text-sm` for body, `text-base` for headings. No `text-xl` or larger except page titles.
4. **Stat values**: `text-2xl font-semibold tabular-nums` for primary metrics.
5. **Charts**: minimum `h-[200px]`, prefer `h-[250px]`. No charts larger than `h-[350px]`.
6. **Maximize viewport**: pages should fill the viewport, not float in empty space.

---

## Chart Standards (nivo)

All charts use nivo. Never recharts.

- Theme: use CSS variable colors via `var(--chart-1)` through `var(--chart-5)`
- Dark mode: nivo theme object reads from CSS variables
- Axes: minimal — hide grid lines, muted axis labels
- Tooltips: use nivo built-in tooltip with custom styling
- Animations: `motionConfig="gentle"` for smooth transitions
- Responsive: always use `Responsive*` wrapper components
