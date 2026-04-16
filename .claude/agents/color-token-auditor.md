---
model: haiku
description: Scan for hardcoded color violations against semantic token system
---

# Color Token Auditor

Read-only audit. Scan all `.tsx` and `.ts` files in `frontend/src/components/` and `frontend/src/app/` for design token violations.

## What to flag

### P0 — Hardcoded colors (never allowed)

- Raw hex: `#fff`, `#000`, `#ffffff`, any `#[0-9a-fA-F]+`
- Raw Tailwind colors: `bg-white`, `text-white`, `bg-black`, `text-black`
- Tailwind palette: `bg-red-*`, `text-blue-*`, `bg-gray-*`, `text-green-*`, etc.
- Inline styles with colors: `style={{ color: ... }}`, `style={{ background: ... }}`

### P1 — Direct palette usage

- Any raw color values in component files — use semantic tokens instead
- `bg-zinc-*`, `text-zinc-*` — use `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`

### P2 — Chart color violations

- Hardcoded hex in nivo chart `colors` props — should use CSS variable references
- Tailwind colors in chart theme objects

## Exceptions (do NOT flag)

- `globals.css` — token definitions use raw colors
- Provider display map (`provider-display.ts`) — brand colors for icons are intentional
- `.test.tsx` / `.spec.tsx` — test files
- `opacity-40`, `opacity-60` on elements — valid element-level opacity

## Output format

```
## P0 Violations (N)
- file:line — `bg-white` -> use `bg-card` or `bg-background`

## P1 Violations (N)
- file:line — `zinc-400` -> use `text-muted-foreground`

## P2 Violations (N)
- file:line — `#5b8def` in chart -> use CSS variable
```
