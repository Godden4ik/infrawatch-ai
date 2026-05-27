import { Geist_Mono, IBM_Plex_Sans } from "next/font/google"

import "./globals.css"
import { Providers } from "@/providers/providers"
import { ToastProvider } from "@/components/ui/toast-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { CoreRouteTabs } from "@/components/layout/core-route-tabs"
import { ExternalToolsStrip } from "@/components/layout/external-tools-strip"

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
        <Providers>
          <TooltipProvider>
            <ToastProvider>
              <div className="flex h-svh flex-col overflow-hidden">
                <header
                  className="z-20 shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-md"
                  style={{ viewTransitionName: "header-shell" }}
                >
                  <div className="flex h-10 items-center justify-between gap-4 px-6">
                    <Breadcrumbs />
                    <div className="flex items-center gap-3">
                      <div
                        className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"
                        style={{ viewTransitionName: "system-status" }}
                      >
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-status-healthy opacity-60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-status-healthy" />
                        </span>
                        <span className="uppercase tracking-[0.14em] text-muted-foreground/80">
                          System Online
                        </span>
                      </div>
                      <ExternalToolsStrip />
                    </div>
                  </div>
                  <CoreRouteTabs />
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-auto px-6 py-5">
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
