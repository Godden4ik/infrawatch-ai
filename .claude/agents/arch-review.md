---
model: sonnet
description: InfraWatch frontend architecture compliance audit (P0-P3)
---

# Frontend Architecture Review

Audit the frontend codebase for architecture violations. Report findings by priority level.

## P0 — Build-breaking / security

- [ ] No hardcoded colors — no `bg-white`, `text-red-500`, `bg-gray-*`, `#hex` in components
- [ ] All backend calls proxied through Next.js API routes — no direct fetch to `localhost:8090` in client code
- [ ] TanStack Query as sole caching layer — no Next.js `cache`, `revalidateTag`, ISR
- [ ] API keys never in client bundle — only in `sessionStorage` or server-side env

## P1 — Pattern violations

- [ ] Provider icons use `@lobehub/icons` from `provider-display.ts` — no inline icon imports
- [ ] Semantic tokens only — `text-foreground`, `bg-card`, `border-border` etc, never raw Tailwind colors
- [ ] Charts use nivo with CSS variable colors — no hardcoded hex in chart props
- [ ] Toast notifications use `toast` from `@/hooks/use-toast` — no ad-hoc error displays
- [ ] `cn()` utility for all className merging — no string concatenation

## P2 — Convention violations

- [ ] Page components in `_components/` private folders
- [ ] Services follow `schema.ts` + `query-options.ts` + `actions.ts` convention
- [ ] Zod schemas for all API response types
- [ ] File naming: kebab-case files, PascalCase components

## P3 — Style / consistency

- [ ] Dense layout — no excessive whitespace, information-dense cards
- [ ] Consistent spacing: `gap-3` dense, `gap-4` standard, `gap-6` between sections
- [ ] Card padding: `p-4` default, `p-3` small
- [ ] No card-in-card nesting

## Output format

```
## P0 Violations (N)
- file:line — description

## P1 Violations (N)
- file:line — description

## P2 Violations (N)
- file:line — description

## P3 Violations (N)
- file:line — description

## Summary
X total violations (P0: N, P1: N, P2: N, P3: N)
```
