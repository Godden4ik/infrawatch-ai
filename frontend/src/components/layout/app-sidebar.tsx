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
  SidebarSeparator,
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
    <Sidebar variant="inset" className="border-r border-sidebar-border">
      {/* Logo */}
      <SidebarHeader className="px-4 py-4">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-sm bg-primary">
            <Activity className="h-3.5 w-3.5 text-primary-foreground" />
          </div>
          <div className="flex flex-col">
            <span className="text-[13px] font-semibold leading-none tracking-tight text-sidebar-foreground">
              InfraWatch
            </span>
            <span className="font-mono text-[10px] leading-none text-muted-foreground/50 tracking-widest">
              AI MONITOR
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      {/* Nav */}
      <SidebarContent className="px-3 py-2">
        {NAV_SECTIONS.map((section, si) => (
          <SidebarGroup key={section.label} className={cn("p-0", si > 0 && "mt-4")}>
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
                        render={<Link href={item.href} />}
                        className={cn(
                          "h-8 gap-2.5 rounded-sm px-2.5 text-[13px] transition-all",
                          active
                            ? "bg-primary/10 text-primary font-medium border border-primary/20"
                            : "text-muted-foreground border border-transparent hover:text-sidebar-foreground hover:bg-sidebar-accent/60",
                        )}
                      >
                        <item.icon
                          className={cn(
                            "h-[15px] w-[15px] shrink-0",
                            active && "text-primary",
                          )}
                        />
                        <span>{item.label}</span>
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
      <SidebarFooter className="px-4 py-3">
        <SidebarSeparator className="mb-3" />
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            <span className="font-mono text-[11px] text-muted-foreground/60">
              System Online
            </span>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground/30">
            v0.2
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
