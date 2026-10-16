import type { Metadata } from "next"
import { Box } from "@chakra-ui/react"

import { Provider } from "@/components/ui/provider"
import { Footer } from "@/components/footer"

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
        <Provider>
          <Box minH="100dvh" display="flex" flexDirection="column">
            <Box flex="1">{children}</Box>
            <Footer />
          </Box>
        </Provider>
      </body>
    </html>
  )
}
