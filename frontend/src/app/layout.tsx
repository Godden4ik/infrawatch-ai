import { Geist_Mono, IBM_Plex_Sans } from "next/font/google"

import "./globals.css"
import { Providers } from "@/providers/providers"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ToastProvider } from "@/components/ui/toast-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/breadcrumbs"
import { CoreRouteTabs } from "@/components/layout/core-route-tabs"

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
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset className="h-svh overflow-hidden">
                  {/* Fixed app header inside shell */}
                  <header className="z-20 shrink-0 border-b border-border/60 bg-background/95 backdrop-blur-md">
                    <div className="flex h-10 items-center gap-2 px-6">
                      <SidebarTrigger className="-ml-1 h-7 w-7" />
                      <Breadcrumbs />
                    </div>
                    <CoreRouteTabs />
                  </header>
                  {/* Content area */}
                  <div className="min-h-0 flex-1 overflow-y-auto overscroll-auto px-6 py-5">
                    {children}
                  </div>
                </SidebarInset>
              </SidebarProvider>
            </ToastProvider>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
