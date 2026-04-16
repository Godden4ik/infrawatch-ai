import { Geist_Mono, IBM_Plex_Sans } from "next/font/google"

import "./globals.css"
import { Providers } from "@/providers/providers"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ToastProvider } from "@/components/ui/toast-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/breadcrumbs"

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
      className={cn("dark antialiased", fontMono.variable, "font-sans", ibmPlexSans.variable)}
    >
      <body>
        <Providers>
          <TooltipProvider>
            <ToastProvider>
              <SidebarProvider>
                <AppSidebar />
                <SidebarInset>
                  {/* Minimal header strip */}
                  <header className="flex h-10 shrink-0 items-center gap-2 px-6">
                    <SidebarTrigger className="-ml-1 h-7 w-7" />
                    <Breadcrumbs />
                  </header>
                  {/* Content area */}
                  <div className="flex-1 overflow-auto px-6 py-5">
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
