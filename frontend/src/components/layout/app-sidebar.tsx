"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Activity,
  Zap,
  Workflow,
  Network,
  FlaskConical,
  KeyRound,
  LayoutDashboard,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarHeader,
  SidebarFooter,
  SidebarLabel,
  SidebarSeparator,
  SidebarRail,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const NAV_SECTIONS = [
  {
    label: "Monitor",
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard },
      { href: "/dashboard", label: "Service Health", icon: Activity },
      { href: "/anomaly", label: "Anomaly Injection", icon: Zap },
    ],
  },
  {
    label: "Analysis",
    items: [
      { href: "/pipeline", label: "Agent Pipeline", icon: Workflow },
      { href: "/topology", label: "Topology", icon: Network },
      { href: "/evaluation", label: "RAG Evaluation", icon: FlaskConical },
    ],
  },
  {
    label: "Settings",
    items: [{ href: "/providers", label: "Providers", icon: KeyRound }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  return (
    <Sidebar variant="floating" collapsible="icon">
      {/* Logo */}
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary">
                <Activity className="h-3.5 w-3.5 text-primary-foreground" />
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-[13px] font-semibold tracking-tight text-sidebar-foreground">
                  InfraWatch
                </span>
                <span className="truncate font-mono text-[10px] text-muted-foreground/50 tracking-widest">
                  AI MONITOR
                </span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Nav */}
      <SidebarContent>
        {NAV_SECTIONS.map((section, si) => (
          <SidebarGroup key={section.label} className={cn("p-2", si > 0 && "pt-0")}>
            <SidebarGroupLabel className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        tooltip={item.label}
                        render={<Link href={item.href} />}
                        className={cn(
                          "h-8 gap-2.5 rounded-sm px-2.5 text-[13px]",
                          active
                            ? "bg-primary/10 text-primary font-medium border border-primary/20"
                            : "text-muted-foreground border border-transparent hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                        )}
                      >
                        <item.icon
                          className={cn(
                            "!h-4 !w-4 shrink-0",
                            active && "text-primary",
                          )}
                        />
                        <SidebarLabel>{item.label}</SidebarLabel>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="p-2">
        <SidebarSeparator className="mb-2" />
        <div className="flex items-center justify-center gap-2 overflow-hidden px-2">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          <SidebarLabel className="font-mono text-[11px] text-muted-foreground/60">
            System Online
          </SidebarLabel>
          <SidebarLabel className="ml-auto font-mono text-[10px] text-muted-foreground/30">
            v0.2
          </SidebarLabel>
        </div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
