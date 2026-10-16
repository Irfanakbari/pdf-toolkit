import type { Metadata } from "next"
import { Box, Flex } from "@chakra-ui/react"

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
          <Flex direction="column" h="100dvh" maxH="100dvh" overflow="hidden">
            <Box
              as="section"
              id="app-scrollable-content"
              flex="1"
              overflowY="auto"
              display="flex"
              flexDirection="column"
              overscrollBehaviorY="contain"
            >
              {children}
            </Box>
            <Footer />
          </Flex>
        </Provider>
      </body>
    </html>
  )
}
