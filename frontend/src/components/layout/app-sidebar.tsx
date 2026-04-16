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
    <Sidebar className="border-r border-border/40">
      {/* Logo */}
      <SidebarHeader className="border-b border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold tracking-tight">
            InfraWatch
            <span className="ml-1 font-mono text-[10px] text-muted-foreground/60 tracking-wider">
              AI
            </span>
          </span>
        </div>
      </SidebarHeader>

      {/* Nav */}
      <SidebarContent className="px-2 py-3">
        {NAV_SECTIONS.map((section) => (
          <SidebarGroup key={section.label} className="mb-3 p-0">
            <SidebarGroupLabel className="mb-0.5 px-2 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/50">
              {section.label}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu className="space-y-px">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        isActive={active}
                        render={<Link href={item.href} />}
                        className={cn(
                          "h-8 gap-2 rounded-md px-2 text-[13px]",
                          active
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/50",
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
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
      <SidebarFooter className="border-t border-border/40 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
          <span className="font-mono text-[11px] text-muted-foreground/70">
            System Online
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
