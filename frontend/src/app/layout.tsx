import { Geist, Geist_Mono } from "next/font/google"

import "./globals.css"
import { Providers } from "@/providers/providers"
import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { ToastProvider } from "@/components/ui/toast-provider"
import { cn } from "@/lib/utils";

const fontSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
})

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
      className={cn("antialiased", fontMono.variable, "font-sans", fontSans.variable)}
    >
      <body>
        <Providers>
          <ToastProvider>
            <SidebarProvider>
              <AppSidebar />
              <main className="flex-1 overflow-auto px-8 py-7">{children}</main>
            </SidebarProvider>
          </ToastProvider>
        </Providers>
      </body>
    </html>
  )
}
