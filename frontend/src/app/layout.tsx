import { Geist_Mono, IBM_Plex_Sans } from "next/font/google"

import "./globals.css"
import { Providers } from "@/providers/providers"
import { ToastProvider } from "@/components/ui/toast-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern"
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { CoreRouteTabs } from "@/components/layout/core-route-tabs"
import { ExternalToolsStrip } from "@/components/layout/external-tools-strip"
import { LogoutButton } from "@/components/layout/logout-button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { env } from "@/env"

const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['300', '400', '500', '600', '700'] })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn(
        "dark h-full antialiased",
        fontMono.variable,
        "font-sans",
        ibmPlexSans.variable,
      )}
    >
      <body className="h-full overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
          <AnimatedGridPattern
            width={32}
            height={32}
            x={-1}
            y={-1}
            numSquares={30}
            maxOpacity={0.08}
            duration={3}
            repeatDelay={0.6}
            className="absolute inset-0 h-full w-full fill-foreground stroke-foreground/[0.04] [mask-image:radial-gradient(ellipse_120%_80%_at_50%_0%,black_30%,transparent_85%)]"
          />
        </div>
        <Providers>
          <TooltipProvider>
            <ToastProvider>
              <div className="flex h-svh flex-col overflow-hidden">
                <header
                  className="z-20 shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-md"
                  style={{ viewTransitionName: "header-shell" }}
                >
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
                      <ExternalToolsStrip />
                      {env.DEMO_PASSWORD ? <LogoutButton /> : null}
                    </div>
                  </div>
                  <CoreRouteTabs />
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-auto px-3 py-4 sm:px-6 sm:py-5">
                  {children}
                </div>
              </div>
            </ToastProvider>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
