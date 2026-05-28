import { Geist_Mono, IBM_Plex_Sans } from "next/font/google"

import "./globals.css"
import { Providers } from "@/providers/providers"
import { ToastProvider } from "@/components/ui/toast-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AnimatedGridPattern } from "@/components/ui/animated-grid-pattern"
import { cn } from "@/lib/utils";
import { AuthAwareChrome } from "@/components/layout/auth-aware-chrome"
import { ExternalServicesProvider } from "@/lib/external-services-context"
import { env } from "@/env"
import { headers } from "next/headers"

// Opt out of static layout caching: env.PUBLIC_*_URL is read per request so
// changing the docker-compose env applies on container restart without a
// rebuild. Calling headers() implicitly forces dynamic rendering.
export const dynamic = "force-dynamic"

export const viewport = {
  // Prevents iOS Safari from zooming into form inputs (16 px input rule
  // is enforced separately via globals.css), while still allowing
  // pinch-zoom for accessibility (maximumScale=1 would break that).
  width: "device-width",
  initialScale: 1,
  // viewportFit=cover lets us read env(safe-area-inset-*) so the header
  // dodges the notch and the scroll container clears the home indicator.
  viewportFit: "cover" as const,
  // Tints the iOS Safari status bar to match the app shell instead of
  // showing the white default while the page scrolls.
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
  ],
}

const ibmPlexSans = IBM_Plex_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['300', '400', '500', '600', '700'] })

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Touch headers() so Next.js treats this layout as dynamic (otherwise it
  // gets statically rendered at build time and bakes in old env values).
  await headers()
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
      <body className="h-full overflow-hidden overscroll-none bg-background text-foreground">
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
          <ExternalServicesProvider
            urls={{
              grafana: env.PUBLIC_GRAFANA_URL,
              prometheus: env.PUBLIC_PROMETHEUS_URL,
              neo4j: env.PUBLIC_NEO4J_URL,
            }}
          >
          <TooltipProvider>
            <ToastProvider>
              <div className="flex h-dvh flex-col overflow-hidden">
                <header
                  className="z-20 shrink-0 border-b border-border/60 bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-md"
                  style={{ viewTransitionName: "header-shell" }}
                >
                  <AuthAwareChrome authEnabled={!!env.DEMO_PASSWORD} />
                </header>
                <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pt-5">
                  {children}
                </div>
              </div>
            </ToastProvider>
          </TooltipProvider>
          </ExternalServicesProvider>
        </Providers>
      </body>
    </html>
  )
}
