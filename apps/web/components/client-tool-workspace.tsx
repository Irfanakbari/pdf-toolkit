"use client"

import { ChangeEvent, useEffect, useRef, useState } from "react"
import {
  Badge,
  Box,
  Button,
  Field,
  Flex,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Progress,
  SimpleGrid,
  Stack,
  Text,
  Textarea,
} from "@chakra-ui/react"
import { CheckCircle2, Download, FileUp, X } from "lucide-react"
import type { PDFDocumentProxy } from "pdfjs-dist"

import {
  addPageNumbersToPdf,
  addWatermarkToPdf,
  convertPdfToJpg,
  deletePdfDocumentPages,
  downloadBlob,
  extractTextFromPdf,
  formatClientFileName,
  parsePageRanges,
  rotatePdfDocument,
} from "@/lib/client-pdf"
import type { Tool } from "@/lib/tools"

const MAX_BYTES = 100 * 1024 * 1024
const MAX_PAGES = 300

export function ClientToolWorkspace({
  tool,
}: {
  tool: Pick<Tool, "slug" | "title" | "description" | "colorPalette">
}) {
  const [source, setSource] = useState<ArrayBuffer>()
  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy>()
  const [fileName, setFileName] = useState("document.pdf")
  const [fileSize, setFileSize] = useState(0)
  const [totalPages, setTotalPages] = useState(0)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [progress, setProgress] = useState(0)
  const [progressLabel, setProgressLabel] = useState("")
  const [extractedText, setExtractedText] = useState("")

  // rotate-pdf options
  const [rotateDegrees, setRotateDegrees] = useState<90 | 180 | 270>(90)
  const [rotateScope, setRotateScope] = useState<"all" | "custom">("all")
  const [rotateRanges, setRotateRanges] = useState("")

  // delete-pages options
  const [deleteRanges, setDeleteRanges] = useState("")

  // page-numbers options
  const [numberPosition, setNumberPosition] = useState<"bottom-center" | "bottom-right" | "bottom-left">("bottom-center")
  const [numberFormat, setNumberFormat] = useState("Page {n} of {total}")
  const [numberFontSize, setNumberFontSize] = useState(12)
  const [skipFirstPage, setSkipFirstPage] = useState(false)
  const [startNumber, setStartNumber] = useState(1)

  // watermark options
  const [watermarkText, setWatermarkText] = useState("CONFIDENTIAL")
  const [watermarkRotation, setWatermarkRotation] = useState(45)
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.3)
  const [watermarkFontSize, setWatermarkFontSize] = useState(48)
  const [watermarkColor, setWatermarkColor] = useState<"gray" | "red" | "blue">("gray")

  const previewCanvasRef = useRef<HTMLCanvasElement>(null)

  // Render thumbnail of page 1
  useEffect(() => {
    if (!pdfDoc || !previewCanvasRef.current) return
    let cancelled = false
    let task: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | undefined

    const renderPreview = async () => {
      try {
        const page = await pdfDoc.getPage(1)
        if (cancelled || !previewCanvasRef.current) return
        const rotation = tool.slug === "rotate-pdf" && rotateScope === "all" ? rotateDegrees : 0
        const base = page.getViewport({ scale: 1, rotation })
        const viewport = page.getViewport({ scale: Math.min(1.2, 220 / base.width), rotation })
        const ctx = previewCanvasRef.current.getContext("2d")
        if (!ctx) return
        previewCanvasRef.current.width = viewport.width
        previewCanvasRef.current.height = viewport.height
        task = page.render({ canvas: previewCanvasRef.current, canvasContext: ctx, viewport })
        await task.promise
      } catch {
        // ignore preview render cancellation
      }
    }

    void renderPreview()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [pdfDoc, tool.slug, rotateDegrees, rotateScope])

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setError("")
    setSuccess("")

    if (file.size > MAX_BYTES) {
      return setError("PDF file size must not exceed 100 MB.")
    }
    if (file.type && file.type !== "application/pdf") {
      return setError("Please select a valid PDF file.")
    }

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

      setPdfDoc(loaded)
      setSource(data)
      setFileName(file.name)
      setFileSize(file.size)
      setTotalPages(loaded.numPages)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to read PDF file.")
    } finally {
      setBusy(false)
      event.target.value = ""
    }
  }

  function resetFile() {
    setPdfDoc(undefined)
    setSource(undefined)
    setFileName("document.pdf")
    setFileSize(0)
    setTotalPages(0)
    setError("")
    setSuccess("")
    setProgress(0)
    setProgressLabel("")
    setExtractedText("")
  }

  async function handleProcess() {
    if (!source || !pdfDoc) return setError("Please select a PDF file first.")
    setBusy(true)
    setError("")
    setSuccess("")
    setProgress(15)
    setProgressLabel("Processing document...")

    try {
      if (tool.slug === "rotate-pdf") {
        const bytes = await rotatePdfDocument(source, {
          degrees: rotateDegrees,
          scope: rotateScope,
          rangeText: rotateRanges,
        })
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
        const downloadName = formatClientFileName(fileName, "pdf")
        downloadBlob(blob, downloadName)
        setSuccess(`Rotated PDF successfully. File downloaded as ${downloadName}.`)
      } else if (tool.slug === "delete-pages") {
        const bytes = await deletePdfDocumentPages(source, deleteRanges)
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
        const downloadName = formatClientFileName(fileName, "pdf")
        downloadBlob(blob, downloadName)
        setSuccess(`Deleted pages successfully. File downloaded as ${downloadName}.`)
      } else if (tool.slug === "page-numbers") {
        const bytes = await addPageNumbersToPdf(source, {
          position: numberPosition,
          fontSize: numberFontSize,
          format: numberFormat,
          startNumber,
          skipFirstPage,
        })
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
        const downloadName = formatClientFileName(fileName, "pdf")
        downloadBlob(blob, downloadName)
        setSuccess(`Added page numbers successfully. File downloaded as ${downloadName}.`)
      } else if (tool.slug === "watermark") {
        const bytes = await addWatermarkToPdf(source, {
          text: watermarkText,
          rotation: watermarkRotation,
          opacity: watermarkOpacity,
          fontSize: watermarkFontSize,
          color: watermarkColor,
        })
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
        const downloadName = formatClientFileName(fileName, "pdf")
        downloadBlob(blob, downloadName)
        setSuccess(`Added watermark successfully. File downloaded as ${downloadName}.`)
      } else if (tool.slug === "pdf-to-jpg") {
        setProgressLabel("Rendering pages to images...")
        const result = await convertPdfToJpg(source, (curr, tot) => {
          setProgress(Math.round((curr / tot) * 90))
          setProgressLabel(`Rendering page ${curr} of ${tot}...`)
        })

        if (result.singleImage) {
          const downloadName = formatClientFileName(fileName, "jpg")
          downloadBlob(result.singleImage, downloadName)
          setSuccess(`Converted PDF to JPG successfully. File downloaded as ${downloadName}.`)
        } else if (result.zipBlob) {
          const downloadName = formatClientFileName(fileName, "zip")
          downloadBlob(result.zipBlob, downloadName)
          setSuccess(`Converted ${result.totalPages} pages to ZIP successfully. File downloaded as ${downloadName}.`)
        }
      } else if (tool.slug === "extract-text") {
        setProgressLabel("Extracting text from pages...")
        const textContent = await extractTextFromPdf(pdfDoc, (curr, tot) => {
          setProgress(Math.round((curr / tot) * 90))
          setProgressLabel(`Extracting page ${curr} of ${tot}...`)
        })
        setExtractedText(textContent)
        const stem = fileName.replace(/\.[^.]+$/, "") || "document"
        const downloadName = `${stem}.txt`
        const textBlob = new Blob([textContent], { type: "text/plain;charset=utf-8" })
        downloadBlob(textBlob, downloadName)
        setSuccess(`Extracted text successfully. File downloaded as ${downloadName}.`)
      }
      setProgress(100)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "An error occurred while processing the file.")
    } finally {
      setBusy(false)
    }
  }

  // Pre-calculated page delete preview
  const pagesToDeleteCount = parsePageRanges(deleteRanges, totalPages).length

  if (!pdfDoc) {
    return (
      <Stack gap="7">
        <Stack
          align="center"
          borderWidth="2px"
          borderStyle="dashed"
          borderColor={`${tool.colorPalette}.300`}
          rounded="2xl"
          p={{ base: "8", md: "12" }}
          textAlign="center"
          bg={`${tool.colorPalette}.subtle`}
          gap="3"
        >
          <FileUp size={40} aria-hidden="true" />
          <Heading size="xl">Select PDF file</Heading>
          <Text color="fg.muted">
            Maximum 100 MB and 300 pages. Fast and secure client-side processing.
          </Text>
          <Button as="label" colorPalette={tool.colorPalette} cursor="pointer" loading={busy}>
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
        </Stack>
        {error && (
          <Text role="alert" color="red.fg" fontWeight="medium">
            {error}
          </Text>
        )}
      </Stack>
    )
  }

  return (
    <Stack gap="6">
      {/* File info banner */}
      <Flex
        bg="bg.panel"
        borderWidth="1px"
        rounded="xl"
        p="4"
        align="center"
        justify="space-between"
        gap="3"
        wrap="wrap"
      >
        <Stack gap="1" flex="1" minW="48">
          <HStack gap="2">
            <Text fontWeight="semibold" fontSize="md" truncate>
              {fileName}
            </Text>
            <Badge colorPalette={tool.colorPalette} variant="subtle">
              {totalPages} Pages
            </Badge>
          </HStack>
          <Text color="fg.muted" fontSize="xs">
            Size: {(fileSize / 1024 / 1024).toFixed(2)} MB
          </Text>
        </Stack>
        <Button variant="ghost" size="sm" onClick={resetFile} disabled={busy}>
          <X size={16} /> Change File
        </Button>
      </Flex>

      {/* Main Grid: Left preview, Right options */}
      <SimpleGrid columns={{ base: 1, md: 3 }} gap="6" alignItems="start">
        {/* Left: Preview thumbnail */}
        <Box
          bg="bg.panel"
          borderWidth="1px"
          rounded="xl"
          p="4"
          display="flex"
          flexDirection="column"
          alignItems="center"
          gap="3"
        >
          <Text fontSize="sm" fontWeight="semibold" color="fg.muted">
            First Page Preview
          </Text>
          <Box
            minH="220px"
            w="full"
            display="grid"
            placeItems="center"
            bg="bg.muted"
            rounded="lg"
            overflow="hidden"
            p="2"
          >
            <canvas ref={previewCanvasRef} aria-label="PDF page preview" />
          </Box>
          <Text fontSize="xs" color="fg.muted" textAlign="center">
            {tool.slug === "rotate-pdf"
              ? "Rotation preview on first page"
              : `Total ${totalPages} pages detected`}
          </Text>
        </Box>

        {/* Right: Tool-specific configuration */}
        <Box gridColumn={{ base: "span 1", md: "span 2" }} bg="bg.panel" borderWidth="1px" rounded="xl" p="6">
          <Stack gap="5">
            <Heading size="md" borderBottomWidth="1px" pb="3">
              {tool.title} Settings
            </Heading>

            {/* rotate-pdf options */}
            {tool.slug === "rotate-pdf" && (
              <Stack gap="4">
                <Field.Root>
                  <Field.Label>Rotation Angle</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={String(rotateDegrees)}
                      onChange={(e) => setRotateDegrees(Number(e.target.value) as 90 | 180 | 270)}
                    >
                      <option value="90">90° (Clockwise)</option>
                      <option value="180">180° (Half turn)</option>
                      <option value="270">270° (Counter-clockwise)</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Page Scope</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={rotateScope}
                      onChange={(e) => setRotateScope(e.target.value as "all" | "custom")}
                    >
                      <option value="all">All Pages ({totalPages} pages)</option>
                      <option value="custom">Selected Pages Only</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                {rotateScope === "custom" && (
                  <Field.Root>
                    <Field.Label>Page Ranges</Field.Label>
                    <Input
                      value={rotateRanges}
                      onChange={(e) => setRotateRanges(e.target.value)}
                      placeholder="e.g., 1-3, 5, 8-"
                    />
                    <Text fontSize="xs" color="fg.muted" mt="1">
                      Specify page numbers to rotate separated by commas or hyphens (-).
                    </Text>
                  </Field.Root>
                )}
              </Stack>
            )}

            {/* delete-pages options */}
            {tool.slug === "delete-pages" && (
              <Stack gap="4">
                <Field.Root required>
                  <Field.Label>Pages to Delete</Field.Label>
                  <Input
                    value={deleteRanges}
                    onChange={(e) => setDeleteRanges(e.target.value)}
                    placeholder="e.g., 1, 3-5, 8"
                  />
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    Enter page numbers or ranges to remove from the document.
                  </Text>
                </Field.Root>

                {/* Quick helpers */}
                <Stack gap="2">
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                    Quick Presets:
                  </Text>
                  <Flex wrap="wrap" gap="2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setDeleteRanges("1")}
                    >
                      First Page (1)
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setDeleteRanges(String(totalPages))}
                    >
                      Last Page ({totalPages})
                    </Button>
                    {totalPages > 2 && (
                      <>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            const evens = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 === 0)
                            setDeleteRanges(evens.join(", "))
                          }}
                        >
                          Even Pages
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            const odds = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0)
                            setDeleteRanges(odds.join(", "))
                          }}
                        >
                          Odd Pages
                        </Button>
                      </>
                    )}
                  </Flex>
                </Stack>

                {deleteRanges && (
                  <Box bg="bg.subtle" p="3" rounded="lg" borderWidth="1px">
                    <Text fontSize="sm">
                      <Text as="span" fontWeight="bold" color="red.fg">
                        {pagesToDeleteCount}
                      </Text>{" "}
                      page(s) will be deleted.{" "}
                      <Text as="span" fontWeight="bold" color="teal.fg">
                        {Math.max(0, totalPages - pagesToDeleteCount)}
                      </Text>{" "}
                      page(s) remaining.
                    </Text>
                  </Box>
                )}
              </Stack>
            )}

            {/* page-numbers options */}
            {tool.slug === "page-numbers" && (
              <Stack gap="4">
                <Field.Root>
                  <Field.Label>Number Position</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={numberPosition}
                      onChange={(e) =>
                        setNumberPosition(e.target.value as "bottom-center" | "bottom-right" | "bottom-left")
                      }
                    >
                      <option value="bottom-center">Bottom Center (Recommended)</option>
                      <option value="bottom-right">Bottom Right</option>
                      <option value="bottom-left">Bottom Left</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Numbering Format</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={numberFormat}
                      onChange={(e) => setNumberFormat(e.target.value)}
                    >
                      <option value="Page {n} of {total}">Page 1 of {totalPages}</option>
                      <option value="{n} / {total}">1 / {totalPages}</option>
                      <option value="{n}">1, 2, 3... (Numbers only)</option>
                      <option value="p. {n}">p. 1</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                  <Field.Root>
                    <Field.Label>Font Size</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={String(numberFontSize)}
                        onChange={(e) => setNumberFontSize(Number(e.target.value))}
                      >
                        <option value="10">10 pt (Small)</option>
                        <option value="12">12 pt (Standard)</option>
                        <option value="14">14 pt (Large)</option>
                        <option value="16">16 pt (Extra)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Cover Page</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={skipFirstPage ? "skip" : "include"}
                        onChange={(e) => setSkipFirstPage(e.target.value === "skip")}
                      >
                        <option value="include">Number all pages</option>
                        <option value="skip">Skip first page (Cover)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                </SimpleGrid>

                <Field.Root>
                  <Field.Label>Start at Number</Field.Label>
                  <Input
                    type="number"
                    min="1"
                    value={startNumber}
                    onChange={(e) => setStartNumber(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  />
                </Field.Root>
              </Stack>
            )}

            {/* watermark options */}
            {tool.slug === "watermark" && (
              <Stack gap="4">
                <Field.Root required>
                  <Field.Label>Watermark Text</Field.Label>
                  <Input
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="e.g., CONFIDENTIAL / DRAFT / PT VUTEQ INDONESIA"
                  />
                </Field.Root>

                {/* Quick text chips */}
                <Flex wrap="wrap" gap="2">
                  {["CONFIDENTIAL", "DRAFT", "PT VUTEQ INDONESIA", "INTERNAL USE"].map((chip) => (
                    <Button
                      key={chip}
                      size="xs"
                      variant="outline"
                      onClick={() => setWatermarkText(chip)}
                    >
                      {chip}
                    </Button>
                  ))}
                </Flex>

                <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                  <Field.Root>
                    <Field.Label>Rotation Angle</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={String(watermarkRotation)}
                        onChange={(e) => setWatermarkRotation(Number(e.target.value))}
                      >
                        <option value="45">45° (Standard diagonal)</option>
                        <option value="0">0° (Horizontal flat)</option>
                        <option value="-45">-45° (Reverse diagonal)</option>
                        <option value="90">90° (Vertical upright)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Transparency (Opacity)</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={String(watermarkOpacity)}
                        onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                      >
                        <option value="0.15">15% (Very faint)</option>
                        <option value="0.3">30% (Standard recommended)</option>
                        <option value="0.5">50% (Medium)</option>
                        <option value="0.7">70% (Solid)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                </SimpleGrid>

                <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                  <Field.Root>
                    <Field.Label>Font Size</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={String(watermarkFontSize)}
                        onChange={(e) => setWatermarkFontSize(Number(e.target.value))}
                      >
                        <option value="32">32 pt (Small)</option>
                        <option value="48">48 pt (Standard)</option>
                        <option value="64">64 pt (Large)</option>
                        <option value="80">80 pt (Extra large)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Text Color</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={watermarkColor}
                        onChange={(e) => setWatermarkColor(e.target.value as "gray" | "red" | "blue")}
                      >
                        <option value="gray">Gray (Neutral)</option>
                        <option value="red">Red (Notice / Warning)</option>
                        <option value="blue">Blue (Formal)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                </SimpleGrid>
              </Stack>
            )}

            {/* pdf-to-jpg options */}
            {tool.slug === "pdf-to-jpg" && (
              <Stack gap="4">
                <Box bg="bg.subtle" p="4" rounded="xl" borderWidth="1px">
                  <Heading size="xs" mb="2" color="teal.fg">
                    Automatic Output Format
                  </Heading>
                  <Text fontSize="sm" color="fg.muted">
                    {totalPages === 1
                      ? "The document has 1 page. The image will be downloaded directly as a high-quality JPG file."
                      : `The document has ${totalPages} pages. Each page will be converted into a JPG image and packaged into a ZIP archive.`}
                  </Text>
                </Box>
              </Stack>
            )}

            {/* extract-text options */}
            {tool.slug === "extract-text" && (
              <Stack gap="4">
                <Box bg="bg.subtle" p="4" rounded="xl" borderWidth="1px">
                  <Heading size="xs" mb="2" color="teal.fg">
                    Plain Text Extraction
                  </Heading>
                  <Text fontSize="sm" color="fg.muted">
                    All text content from {totalPages} pages will be extracted and downloaded as a clean .txt file.
                  </Text>
                </Box>
                {extractedText && (
                  <Field.Root>
                    <Field.Label>Extracted Preview</Field.Label>
                    <Textarea
                      value={extractedText}
                      readOnly
                      rows={8}
                      p="3"
                      fontSize="xs"
                      fontFamily="mono"
                      rounded="lg"
                      borderWidth="1px"
                      bg="bg.muted"
                      w="full"
                    />
                  </Field.Root>
                )}
              </Stack>
            )}

            {/* Progress indicator */}
            {busy && (
              <Stack gap="2">
                <Flex justify="space-between" fontSize="sm">
                  <Text fontWeight="medium">{progressLabel || "Processing..."}</Text>
                  <Text>{progress}%</Text>
                </Flex>
                <Progress.Root value={progress} colorPalette={tool.colorPalette}>
                  <Progress.Track>
                    <Progress.Range />
                  </Progress.Track>
                </Progress.Root>
              </Stack>
            )}

            {/* Error & Success Messages */}
            {error && (
              <Text role="alert" color="red.fg" fontWeight="medium">
                {error}
              </Text>
            )}
            {success && (
              <HStack color="green.fg" fontWeight="medium" gap="2">
                <CheckCircle2 size={18} />
                <Text>{success}</Text>
              </HStack>
            )}

            {/* Action Button */}
            <Button
              colorPalette={tool.colorPalette}
              size="lg"
              onClick={handleProcess}
              loading={busy}
              disabled={busy}
              w="full"
            >
              <Download size={20} />
              {tool.slug === "rotate-pdf" && "Rotate & Download PDF"}
              {tool.slug === "delete-pages" && "Delete Pages & Download PDF"}
              {tool.slug === "page-numbers" && "Add Numbers & Download PDF"}
              {tool.slug === "watermark" && "Add Watermark & Download PDF"}
              {tool.slug === "pdf-to-jpg" && (totalPages > 1 ? "Convert to ZIP (JPG)" : "Convert to JPG")}
              {tool.slug === "extract-text" && "Extract & Download Text (.txt)"}
            </Button>
          </Stack>
        </Box>
      </SimpleGrid>
    </Stack>
  )
}
