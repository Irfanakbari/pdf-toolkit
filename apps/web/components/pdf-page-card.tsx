"use client"

import { useEffect, useRef } from "react"
import { Box, IconButton, Text } from "@chakra-ui/react"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical, RotateCcw, RotateCw, Trash2 } from "lucide-react"
import type { PDFDocumentProxy } from "pdfjs-dist"
import type { PdfPage } from "@/lib/pdf-editor"

export function PdfPageCard({ page, document, onRotate, onDelete }: {
  page: PdfPage
  document: PDFDocumentProxy
  onRotate: (id: string, degrees: 90 | -90) => void
  onDelete: (id: string) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })

  useEffect(() => {
    let cancelled = false
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined
    const render = async () => {
      const pdfPage = await document.getPage(page.sourceIndex + 1)
      if (cancelled || !canvas.current) return
      const base = pdfPage.getViewport({ scale: 1, rotation: page.rotation })
      const viewport = pdfPage.getViewport({ scale: Math.min(1.4, 220 / base.width), rotation: page.rotation })
      const context = canvas.current.getContext("2d")
      if (!context) return
      canvas.current.width = viewport.width
      canvas.current.height = viewport.height
      task = pdfPage.render({ canvas: canvas.current, canvasContext: context, viewport })
      await task.promise
    }
    void render()
    return () => { cancelled = true; task?.cancel() }
  }, [document, page.rotation, page.sourceIndex])

  return <Box ref={setNodeRef} style={{ transform: CSS.Transform.toString(transform), transition }} opacity={isDragging ? 0.55 : 1} bg="bg.panel" borderWidth="1px" rounded="xl" p="3" shadow="sm">
    <Box display="flex" justifyContent="space-between" alignItems="center" mb="2">
      <IconButton {...attributes} {...listeners} aria-label={`Pindahkan halaman ${page.sourceIndex + 1}`} variant="ghost" size="sm"><GripVertical /></IconButton>
      <Text fontSize="sm" fontWeight="semibold">Halaman {page.sourceIndex + 1}</Text>
      <IconButton aria-label={`Hapus halaman ${page.sourceIndex + 1}`} variant="ghost" colorPalette="red" size="sm" onClick={() => onDelete(page.id)}><Trash2 /></IconButton>
    </Box>
    <Box minH="220px" display="grid" placeItems="center" bg="bg.muted" rounded="lg" overflow="hidden"><canvas ref={canvas} aria-label={`Pratinjau halaman ${page.sourceIndex + 1}`} /></Box>
    <Box display="flex" justifyContent="center" gap="2" mt="3">
      <IconButton aria-label={`Putar halaman ${page.sourceIndex + 1} ke kiri`} variant="outline" size="sm" onClick={() => onRotate(page.id, -90)}><RotateCcw /></IconButton>
      <IconButton aria-label={`Putar halaman ${page.sourceIndex + 1} ke kanan`} variant="outline" size="sm" onClick={() => onRotate(page.id, 90)}><RotateCw /></IconButton>
    </Box>
  </Box>
}
