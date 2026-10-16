import type { Metadata } from "next"
import { Provider } from "@/components/ui/provider"
import "./globals.css"

export const metadata: Metadata = { title: "PDF Toolkit", description: "Alat PDF aman dan praktis" }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id" suppressHydrationWarning><body><Provider>{children}</Provider></body></html>
}
