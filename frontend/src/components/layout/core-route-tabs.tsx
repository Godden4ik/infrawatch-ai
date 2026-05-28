"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
  Menu,
  Network,
  Target,
  Workflow,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV_TABS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard", label: "Service Health", icon: Activity },
  { href: "/anomaly", label: "Anomaly", icon: Zap },
  { href: "/pipeline", label: "Pipeline", icon: Workflow },
  { href: "/topology", label: "Topology", icon: Network },
  { href: "/evaluation", label: "Evaluation", icon: FlaskConical },
  { href: "/evaluation/benchmark", label: "Accuracy", icon: Target },
  { href: "/providers", label: "Providers", icon: KeyRound },
] as const;

function matchesPath(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (pathname === href) return true;
  return pathname.startsWith(href + "/");
}

function pickActiveHref(pathname: string) {
  let best: string | null = null;
  for (const tab of NAV_TABS) {
    if (!matchesPath(pathname, tab.href)) continue;
    if (best === null || tab.href.length > best.length) best = tab.href;
  }
  return best;
}

export function CoreRouteTabs() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const activeHref = pickActiveHref(pathname);
  const activeTab = NAV_TABS.find((tab) => tab.href === activeHref);

  return (
    <div className="border-t border-border/60 px-3 py-2 sm:px-6">
      <div className="hidden min-w-0 items-center gap-1 overflow-x-auto md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {NAV_TABS.map((tab) => {
          const active = tab.href === activeHref;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "relative isolate inline-flex h-9 shrink-0 items-center gap-2 border border-transparent px-3 text-[11px] font-medium tracking-[0.14em] uppercase transition-colors",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:border-border/70 hover:bg-card/50 hover:text-foreground",
              )}
            >
              {active && (
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-0 -z-10 border border-border bg-card shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
                  style={{ viewTransitionName: "active-tab-indicator" }}
                />
              )}
              <tab.icon className="h-3.5 w-3.5 shrink-0" />
              <span className="whitespace-nowrap">{tab.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-3 md:hidden">
        <div className="min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground/70">
            Navigation
          </p>
          <p className="truncate text-sm text-foreground">
            {activeTab?.label ?? "Overview"}
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className="shrink-0 gap-2"
        >
          <Menu className="h-4 w-4" />
          Menu
        </Button>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="border-l border-border bg-background">
          <SheetHeader className="border-b border-border/60 px-5 py-4">
            <SheetTitle>Navigation</SheetTitle>
            <SheetDescription>
              Jump between monitoring, analysis, and provider screens.
            </SheetDescription>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-2 p-4">
            {NAV_TABS.map((tab) => {
              const active = tab.href === activeHref;

              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "inline-flex items-center gap-3 border px-3 py-3 text-sm transition-colors",
                    active
                      ? "border-border bg-card text-foreground"
                      : "border-transparent text-muted-foreground hover:border-border/70 hover:bg-card/50 hover:text-foreground",
                  )}
                >
                  <tab.icon className="h-4 w-4 shrink-0" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
