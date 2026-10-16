import Link from "next/link"
import { Box, Button, Container, Heading, Stack, Text } from "@chakra-ui/react"
import { notFound } from "next/navigation"
import { ToolWorkspace } from "@/components/tool-workspace"
import { toolBySlug, tools } from "@/lib/tools"

export function generateStaticParams() { return tools.map((tool) => ({ tool: tool.slug })) }
export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) { const { tool: slug } = await params; const tool = toolBySlug(slug); if (!tool) notFound(); return <Box minH="100vh"><Container maxW="4xl" py={{ base: "7", md: "12" }}><Button asChild variant="ghost" mb="8"><Link href="/">← Semua alat</Link></Button><Stack gap="3" mb="8"><Text color="teal.600" fontWeight="bold">PDF TOOLKIT</Text><Heading as="h1" size={{ base: "3xl", md: "5xl" }}>{tool.title}</Heading><Text color="fg.muted" fontSize="lg">{tool.description} File terhapus otomatis setelah 24 jam.</Text></Stack><ToolWorkspace tool={tool} /></Container></Box> }
