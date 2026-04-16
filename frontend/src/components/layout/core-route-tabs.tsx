"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  LayoutDashboard,
  Network,
  Workflow,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CORE_TABS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard", label: "Service Health", icon: Activity },
  { href: "/anomaly", label: "Anomaly", icon: Zap },
  { href: "/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/topology", label: "Topology", icon: Network },
] as const;

const UTILITY_LINKS = [
  { href: "/evaluation", label: "Evaluation" },
  { href: "/providers", label: "Providers" },
] as const;

function isActivePath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function CoreRouteTabs() {
  const pathname = usePathname();

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 border-t border-border/60 px-6 py-2">
      <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CORE_TABS.map((tab) => {
          const active = isActivePath(pathname, tab.href);

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "inline-flex h-9 shrink-0 items-center gap-2 border px-3 text-[11px] font-medium tracking-[0.14em] uppercase transition-colors",
                active
                  ? "border-border bg-card text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
                  : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-card/50 hover:text-foreground",
              )}
            >
              <tab.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="hidden items-center gap-1 lg:flex">
        {UTILITY_LINKS.map((link) => {
          const active = isActivePath(pathname, link.href);

          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "inline-flex h-8 items-center border px-2.5 font-mono text-[10px] tracking-[0.12em] uppercase transition-colors",
                active
                  ? "border-border bg-card text-foreground"
                  : "border-transparent text-muted-foreground hover:border-border/60 hover:text-foreground",
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
