"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

const ROUTE_LABELS: Record<string, string> = {
  "/": "Overview",
  "/dashboard": "Service Health",
  "/anomaly": "Anomaly Injection",
  "/pipeline": "Agent Pipeline",
  "/topology": "Topology",
  "/evaluation": "RAG Evaluation",
  "/evaluation/benchmark": "Accuracy Benchmark",
  "/providers": "Providers",
};

function labelFor(path: string) {
  if (ROUTE_LABELS[path]) return ROUTE_LABELS[path];
  const last = path.split("/").filter(Boolean).pop() ?? "";
  return last
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildCrumbs(pathname: string): { href: string; label: string }[] {
  if (pathname === "/") return [{ href: "/", label: ROUTE_LABELS["/"] }];
  const segments = pathname.split("/").filter(Boolean);
  const crumbs: { href: string; label: string }[] = [];
  let accumulated = "";
  for (const segment of segments) {
    accumulated += `/${segment}`;
    crumbs.push({ href: accumulated, label: labelFor(accumulated) });
  }
  return crumbs;
}

export function Breadcrumbs() {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  const last = crumbs.length - 1;

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
    >
      <Link
        href="/"
        className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        InfraWatch
      </Link>
      {crumbs.map((crumb, i) => {
        const isLast = i === last;
        return (
          <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground/30" />
            {isLast ? (
              <span className="truncate font-medium text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link
                href={crumb.href}
                className="truncate text-muted-foreground/70 transition-colors hover:text-foreground"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        );
      })}
    </nav>
  );
}
