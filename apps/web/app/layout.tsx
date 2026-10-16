import type { Metadata } from "next"

import { Provider } from "@/components/ui/provider"

import "./globals.css"

export const metadata: Metadata = {
  title: "VUTEQ INDONESIA | PDF Toolkit",
  description: "PDF Toolkit VUTEQ INDONESIA",
  icons: { icon: "/brand/vuteq-logo.png" },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
