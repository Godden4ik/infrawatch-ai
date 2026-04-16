import { Geist_Mono, IBM_Plex_Sans, Merriweather } from "next/font/google"

import "./globals.css"
import { Providers } from "@/providers/providers"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ToastProvider } from "@/components/ui/toast-provider"
import { TooltipProvider } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils";

const merriweatherHeading = Merriweather({subsets:['latin'],variable:'--font-heading'});

const ibmPlexSans = IBM_Plex_Sans({subsets:['latin'],variable:'--font-sans'})

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
      className={cn("dark antialiased", fontMono.variable, "font-sans", ibmPlexSans.variable, merriweatherHeading.variable)}
    >
      <body>
        <Providers>
          <TooltipProvider>
            <ToastProvider>
              <SidebarProvider>
                <AppSidebar />
                <main className="flex-1 overflow-auto bg-background">
                  <div className="h-full px-6 py-6">{children}</div>
                </main>
              </SidebarProvider>
            </ToastProvider>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  )
}
