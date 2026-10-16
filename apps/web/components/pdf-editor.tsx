"use client"

import { ChangeEvent, useReducer, useState } from "react"
import { Box, Button, Heading, Input, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core"
import {
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable"
import { Download, FileUp, RotateCcw, Undo2 } from "lucide-react"
import { degrees, PDFDocument } from "pdf-lib"
import type { PDFDocumentProxy } from "pdfjs-dist"

import { PdfPageCard } from "@/components/pdf-page-card"
import { formatClientFileName } from "@/lib/client-pdf"
import { editorReducer, initialEditorState } from "@/lib/pdf-editor"

const MAX_BYTES = 100 * 1024 * 1024
const MAX_PAGES = 300

export function PdfEditor() {
  const [state, dispatch] = useReducer(editorReducer, initialEditorState)
  const [source, setSource] = useState<ArrayBuffer>()
  const [document, setDocument] = useState<PDFDocumentProxy>()
  const [fileName, setFileName] = useState("document.pdf")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError("")
    if (file.size > MAX_BYTES) return setError("PDF file size must not exceed 100 MB.")
    if (file.type && file.type !== "application/pdf") return setError("Please select a valid PDF file.")
    setBusy(true)
    try {
      const data = await file.arrayBuffer()
      const magic = new TextDecoder().decode(data.slice(0, 5))
      if (magic !== "%PDF-") throw new Error("The selected file is not a valid PDF document.")
      const pdfjs = await import("pdfjs-dist")
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString()
      const loaded = await pdfjs.getDocument({ data: data.slice(0) }).promise
      if (loaded.numPages > MAX_PAGES) throw new Error("PDF exceeds maximum limit of 300 pages.")
      setDocument(loaded)
      setSource(data)
      setFileName(file.name)
      dispatch({ type: "load", count: loaded.numPages })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to open PDF document.")
    } finally {
      setBusy(false)
      event.target.value = ""
    }
  }

  function moved(event: DragEndEvent) {
    if (event.over) {
      dispatch({ type: "move", activeId: String(event.active.id), overId: String(event.over.id) })
    }
  }

  async function exportPdf() {
    if (!source || state.pages.length === 0) return setError("Please keep at least one page to export.")
    setBusy(true)
    setError("")
    try {
      const original = await PDFDocument.load(source)
      const output = await PDFDocument.create()
      for (const page of state.pages) {
        const [copied] = await output.copyPages(original, [page.sourceIndex])
        copied.setRotation(degrees(page.rotation))
        output.addPage(copied)
      }
      const bytes = await output.save()
      const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
      const url = URL.createObjectURL(blob)
      const link = window.document.createElement("a")
      link.href = url
      link.download = formatClientFileName(fileName, "pdf")
      link.click()
      URL.revokeObjectURL(url)
    } catch {
      setError("Failed to export PDF. Please reload the file.")
    } finally {
      setBusy(false)
    }
  }

  if (!document) {
    return (
      <Stack
        gap="5"
        align="center"
        borderWidth="2px"
        borderStyle="dashed"
        borderColor="teal.300"
        rounded="2xl"
        p={{ base: "8", md: "14" }}
        bg="teal.subtle"
        textAlign="center"
      >
        <FileUp size={38} aria-hidden="true" />
        <Stack gap="2">
          <Heading size="xl">Select a PDF file</Heading>
          <Text color="fg.muted">Maximum 100 MB and 300 pages.</Text>
        </Stack>
        <Button as="label" colorPalette="teal" loading={busy} cursor="pointer">
          Choose PDF
          <Input
            type="file"
            accept="application/pdf,.pdf"
            onChange={pick}
            position="absolute"
            opacity="0"
            width="1px"
            height="1px"
          />
        </Button>
        {error && (
          <Text role="alert" color="red.fg">
            {error}
          </Text>
        )}
      </Stack>
    )
  }

  return (
    <Stack gap="6">
      <Box
        position="sticky"
        top="3"
        zIndex="docked"
        bg="bg.panel"
        borderWidth="1px"
        rounded="xl"
        p="3"
        shadow="md"
        display="flex"
        flexWrap="wrap"
        gap="2"
        alignItems="center"
      >
        <Text fontWeight="semibold" flex="1" minW="48">
          {fileName} · {state.pages.length} pages
        </Text>
        <Button variant="outline" onClick={() => dispatch({ type: "restore" })} disabled={!state.deleted.length}>
          <Undo2 /> Restore
        </Button>
        <Button variant="outline" onClick={() => dispatch({ type: "reset" })}>
          <RotateCcw /> Reset
        </Button>
        <Button colorPalette="teal" onClick={exportPdf} loading={busy} disabled={!state.pages.length}>
          <Download /> Export PDF
        </Button>
      </Box>
      {error && (
        <Text role="alert" aria-live="assertive" color="red.fg">
          {error}
        </Text>
      )}
      {!state.pages.length && (
        <Text role="status" textAlign="center" color="fg.muted">
          All pages deleted. Restore pages before exporting.
        </Text>
      )}
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={moved}>
        <SortableContext items={state.pages.map((page) => page.id)} strategy={rectSortingStrategy}>
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap="4">
            {state.pages.map((page) => (
              <PdfPageCard
                key={page.id}
                page={page}
                document={document}
                onRotate={(id, degrees) => dispatch({ type: "rotate", id, degrees })}
                onDelete={(id) => dispatch({ type: "delete", id })}
              />
            ))}
          </SimpleGrid>
        </SortableContext>
      </DndContext>
      <Text aria-live="polite" srOnly>
        {state.pages.length} pages ready to export.
      </Text>
    </Stack>
  )
}
