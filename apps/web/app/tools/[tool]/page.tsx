import dynamic from "next/dynamic"
import Link from "next/link"
import { Box, Button, Container, Heading, Stack, Text } from "@chakra-ui/react"
import { ArrowLeft, LockKeyhole } from "lucide-react"
import { notFound } from "next/navigation"

import { ToolWorkspace } from "@/components/tool-workspace"
import { toolBySlug, tools } from "@/lib/tools"

const PdfEditor = dynamic(
  () => import("@/components/pdf-editor").then((module) => module.PdfEditor),
  { loading: () => <Text>Memuat editor…</Text> },
)

const ClientToolWorkspace = dynamic(
  () => import("@/components/client-tool-workspace").then((module) => module.ClientToolWorkspace),
  { loading: () => <Text>Memuat alat…</Text> },
)

export function generateStaticParams() {
  return tools.map((tool) => ({ tool: tool.slug }))
}

export default async function ToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool: slug } = await params
  const tool = toolBySlug(slug)
  if (!tool) notFound()

  return (
    <Box minH="100vh" bg="bg.canvas">
      <Container maxW={tool.local ? "7xl" : "4xl"} py={{ base: "7", md: "12" }}>
        <Button asChild variant="ghost" mb="8">
          <Link href="/">
            <ArrowLeft /> Semua alat
          </Link>
        </Button>
        <Stack gap="3" mb="8">
          <Text color="teal.fg" fontWeight="bold">
            PDF TOOLKIT
          </Text>
          <Heading as="h1" size={{ base: "3xl", md: "5xl" }}>
            {tool.title}
          </Heading>
          <Text color="fg.muted" fontSize="lg">
            {tool.description}
          </Text>
          {tool.local && (
            <Text display="flex" gap="2" alignItems="center" color="teal.fg" fontWeight="medium">
              <LockKeyhole size={18} /> Semua proses berlangsung di browser. File Anda tidak diunggah.
            </Text>
          )}
        </Stack>
        {tool.local ? (
          tool.slug === "organize" ? (
            <PdfEditor />
          ) : (
            <ClientToolWorkspace
              tool={{
                slug: tool.slug,
                title: tool.title,
                description: tool.description,
                colorPalette: tool.colorPalette,
              }}
            />
          )
        ) : (
          <ToolWorkspace
            tool={{
              slug: tool.slug,
              title: tool.title,
              description: tool.description,
              accept: tool.accept,
              multiple: tool.multiple,
              option: tool.option,
              local: tool.local,
            }}
          />
        )}
      </Container>
    </Box>
  )
}
