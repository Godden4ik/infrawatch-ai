"use client";

import { usePathname } from "next/navigation";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { CoreRouteTabs } from "@/components/layout/core-route-tabs";
import { ExternalToolsStrip } from "@/components/layout/external-tools-strip";
import { LogoutButton } from "@/components/layout/logout-button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface AuthAwareChromeProps {
  /** Render the logout button + tabs only when the gate is enabled. */
  authEnabled: boolean;
}

/**
 * Header chrome that collapses on the login route so an unauthenticated
 * visitor sees only the brand mark + status pill — no nav tabs, no
 * external-tool launchers, no logout button to anchor a leaked URL.
 *
 * On every other route the full chrome renders as before.
 */
export function AuthAwareChrome({ authEnabled }: AuthAwareChromeProps) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";

  return (
    <>
      <div className="flex h-10 items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Breadcrumbs />
        <div className="flex items-center gap-2 sm:gap-3">
          <Tooltip>
            <TooltipTrigger
              render={
                <div
                  className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
                  style={{ viewTransitionName: "system-status" }}
                  aria-label="System Online"
                >
                  <span className="relative flex h-2 w-2 shrink-0">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-healthy opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-status-healthy" />
                  </span>
                  <span className="hidden uppercase tracking-[0.14em] text-muted-foreground/80 sm:inline">
                    System Online
                  </span>
                </div>
              }
            />
            <TooltipContent>
              <span className="font-mono text-[11px]">System Online</span>
            </TooltipContent>
          </Tooltip>
          {!isLogin && (
            <>
              <ExternalToolsStrip />
              {authEnabled && <LogoutButton />}
            </>
          )}
        </div>
      </div>
      {!isLogin && <CoreRouteTabs />}
    </>
  );
}
