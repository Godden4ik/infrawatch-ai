"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Activity,
  Zap,
  Bot,
  Network,
  FlaskConical,
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

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: Home },
  { href: "/dashboard", label: "Service Health", icon: Activity },
  { href: "/anomaly", label: "Anomaly Injection", icon: Zap },
  { href: "/pipeline", label: "Agent Pipeline", icon: Bot },
  { href: "/topology", label: "Topology", icon: Network },
  { href: "/evaluation", label: "RAG Evaluation", icon: FlaskConical },
];

export function AppSidebar() {
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader className="border-b border-border/50 px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15">
            <Activity className="h-5 w-5 text-primary" />
          </div>
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1.5">
              <span className="text-base font-semibold tracking-tight">
                InfraWatch
              </span>
              <span className="text-muted-foreground font-mono text-[11px] tracking-wider opacity-60">
                AI
              </span>
            </div>
            <span className="text-muted-foreground text-xs">
              Infrastructure Monitoring
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="px-3 pt-4">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/60 mb-1 px-3 text-[11px] font-medium uppercase tracking-widest">
            Monitor
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-0.5">
              {NAV_ITEMS.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      isActive={active}
                      render={<Link href={item.href} />}
                      className={cn(
                        "h-10 gap-3 rounded-lg px-3 text-sm",
                        active && "bg-primary/10 text-primary font-medium",
                      )}
                    >
                      <item.icon className="h-[18px] w-[18px]" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-border/50 px-5 py-4">
        <div className="flex items-center gap-2.5">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
          <span className="text-muted-foreground font-mono text-xs">
            System Online
          </span>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
