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
} from "@chakra-ui/react"
import { CheckCircle2, Download, FileUp, X } from "lucide-react"
import type { PDFDocumentProxy } from "pdfjs-dist"

import {
  addPageNumbersToPdf,
  addWatermarkToPdf,
  convertPdfToJpg,
  deletePdfDocumentPages,
  downloadBlob,
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

  // rotate-pdf options
  const [rotateDegrees, setRotateDegrees] = useState<90 | 180 | 270>(90)
  const [rotateScope, setRotateScope] = useState<"all" | "custom">("all")
  const [rotateRanges, setRotateRanges] = useState("")

  // delete-pages options
  const [deleteRanges, setDeleteRanges] = useState("")

  // page-numbers options
  const [numberPosition, setNumberPosition] = useState<"bottom-center" | "bottom-right" | "bottom-left">("bottom-center")
  const [numberFormat, setNumberFormat] = useState("Halaman {n} dari {total}")
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
      return setError("Ukuran PDF maksimal 100 MB.")
    }
    if (file.type && file.type !== "application/pdf") {
      return setError("Pilih file PDF yang valid.")
    }

    setBusy(true)
    try {
      const data = await file.arrayBuffer()
      const magic = new TextDecoder().decode(data.slice(0, 5))
      if (magic !== "%PDF-") throw new Error("File tidak memiliki struktur PDF yang valid.")

      const pdfjs = await import("pdfjs-dist")
      pdfjs.GlobalWorkerOptions.workerSrc = new URL(
        "pdfjs-dist/build/pdf.worker.min.mjs",
        import.meta.url,
      ).toString()

      const loaded = await pdfjs.getDocument({ data: data.slice(0) }).promise
      if (loaded.numPages > MAX_PAGES) throw new Error("PDF maksimal 300 halaman.")

      setPdfDoc(loaded)
      setSource(data)
      setFileName(file.name)
      setFileSize(file.size)
      setTotalPages(loaded.numPages)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Gagal membaca file PDF.")
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
  }

  async function handleProcess() {
    if (!source) return setError("Silakan pilih file PDF terlebih dahulu.")
    setBusy(true)
    setError("")
    setSuccess("")
    setProgress(15)
    setProgressLabel("Memproses dokumen...")

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
        setSuccess(`Berhasil memutar PDF. File diunduh sebagai ${downloadName}.`)
      } else if (tool.slug === "delete-pages") {
        const bytes = await deletePdfDocumentPages(source, deleteRanges)
        const blob = new Blob([bytes as BlobPart], { type: "application/pdf" })
        const downloadName = formatClientFileName(fileName, "pdf")
        downloadBlob(blob, downloadName)
        setSuccess(`Berhasil menghapus halaman. File diunduh sebagai ${downloadName}.`)
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
        setSuccess(`Berhasil memberi nomor halaman. File diunduh sebagai ${downloadName}.`)
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
        setSuccess(`Berhasil menambahkan watermark. File diunduh sebagai ${downloadName}.`)
      } else if (tool.slug === "pdf-to-jpg") {
        setProgressLabel("Merender halaman menjadi gambar...")
        const result = await convertPdfToJpg(source, (curr, tot) => {
          setProgress(Math.round((curr / tot) * 90))
          setProgressLabel(`Merender halaman ${curr} dari ${tot}...`)
        })

        if (result.singleImage) {
          const downloadName = formatClientFileName(fileName, "jpg")
          downloadBlob(result.singleImage, downloadName)
          setSuccess(`Berhasil mengonversi PDF ke JPG. File diunduh sebagai ${downloadName}.`)
        } else if (result.zipBlob) {
          const downloadName = formatClientFileName(fileName, "zip")
          downloadBlob(result.zipBlob, downloadName)
          setSuccess(`Berhasil mengonversi ${result.totalPages} halaman ke ZIP. File diunduh sebagai ${downloadName}.`)
        }
      }
      setProgress(100)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Terjadi kesalahan saat memproses file.")
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
          <Heading size="xl">Pilih file PDF</Heading>
          <Text color="fg.muted">
            Maksimal 100 MB dan 300 halaman. Semua proses berlangsung aman langsung di browser Anda.
          </Text>
          <Button as="label" colorPalette={tool.colorPalette} cursor="pointer" loading={busy}>
            Pilih PDF
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
              {totalPages} Halaman
            </Badge>
          </HStack>
          <Text color="fg.muted" fontSize="xs">
            Ukuran: {(fileSize / 1024 / 1024).toFixed(2)} MB · Diproses secara lokal
          </Text>
        </Stack>
        <Button variant="ghost" size="sm" onClick={resetFile} disabled={busy}>
          <X size={16} /> Ganti File
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
            Pratinjau Halaman Pertama
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
            <canvas ref={previewCanvasRef} aria-label="Pratinjau halaman PDF" />
          </Box>
          <Text fontSize="xs" color="fg.muted" textAlign="center">
            {tool.slug === "rotate-pdf"
              ? "Pratinjau rotasi pada halaman pertama"
              : `Total ${totalPages} halaman terdeteksi`}
          </Text>
        </Box>

        {/* Right: Tool-specific configuration */}
        <Box gridColumn={{ base: "span 1", md: "span 2" }} bg="bg.panel" borderWidth="1px" rounded="xl" p="6">
          <Stack gap="5">
            <Heading size="md" borderBottomWidth="1px" pb="3">
              Pengaturan {tool.title}
            </Heading>

            {/* rotate-pdf options */}
            {tool.slug === "rotate-pdf" && (
              <Stack gap="4">
                <Field.Root>
                  <Field.Label>Sudut Putaran</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={String(rotateDegrees)}
                      onChange={(e) => setRotateDegrees(Number(e.target.value) as 90 | 180 | 270)}
                    >
                      <option value="90">90° (Searah jarum jam)</option>
                      <option value="180">180° (Setengah lingkaran)</option>
                      <option value="270">270° (90° Berlawanan jarum jam)</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Cakupan Halaman</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={rotateScope}
                      onChange={(e) => setRotateScope(e.target.value as "all" | "custom")}
                    >
                      <option value="all">Semua Halaman ({totalPages} halaman)</option>
                      <option value="custom">Halaman Tertentu Saja</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                {rotateScope === "custom" && (
                  <Field.Root>
                    <Field.Label>Rentang Halaman</Field.Label>
                    <Input
                      value={rotateRanges}
                      onChange={(e) => setRotateRanges(e.target.value)}
                      placeholder="Contoh: 1-3, 5, 8-"
                    />
                    <Text fontSize="xs" color="fg.muted" mt="1">
                      Tentukan nomor halaman yang ingin diputar dipisahkan koma atau tanda hubung (-).
                    </Text>
                  </Field.Root>
                )}
              </Stack>
            )}

            {/* delete-pages options */}
            {tool.slug === "delete-pages" && (
              <Stack gap="4">
                <Field.Root required>
                  <Field.Label>Rentang Halaman yang Dihapus</Field.Label>
                  <Input
                    value={deleteRanges}
                    onChange={(e) => setDeleteRanges(e.target.value)}
                    placeholder="Contoh: 1, 3-5, 8"
                  />
                  <Text fontSize="xs" color="fg.muted" mt="1">
                    Masukkan nomor atau rentang halaman yang ingin dibuang dari dokumen.
                  </Text>
                </Field.Root>

                {/* Quick helpers */}
                <Stack gap="2">
                  <Text fontSize="xs" fontWeight="semibold" color="fg.muted">
                    Pintasan Cepat:
                  </Text>
                  <Flex wrap="wrap" gap="2">
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setDeleteRanges("1")}
                    >
                      Halaman Pertama (1)
                    </Button>
                    <Button
                      size="xs"
                      variant="outline"
                      onClick={() => setDeleteRanges(String(totalPages))}
                    >
                      Halaman Terakhir ({totalPages})
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
                          Halaman Genap
                        </Button>
                        <Button
                          size="xs"
                          variant="outline"
                          onClick={() => {
                            const odds = Array.from({ length: totalPages }, (_, i) => i + 1).filter((p) => p % 2 !== 0)
                            setDeleteRanges(odds.join(", "))
                          }}
                        >
                          Halaman Ganjil
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
                      halaman akan dihapus. Tersisa{" "}
                      <Text as="span" fontWeight="bold" color="teal.fg">
                        {Math.max(0, totalPages - pagesToDeleteCount)}
                      </Text>{" "}
                      halaman.
                    </Text>
                  </Box>
                )}
              </Stack>
            )}

            {/* page-numbers options */}
            {tool.slug === "page-numbers" && (
              <Stack gap="4">
                <Field.Root>
                  <Field.Label>Posisi Nomor Halaman</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={numberPosition}
                      onChange={(e) =>
                        setNumberPosition(e.target.value as "bottom-center" | "bottom-right" | "bottom-left")
                      }
                    >
                      <option value="bottom-center">Bawah Tengah (Rekomendasi)</option>
                      <option value="bottom-right">Bawah Kanan</option>
                      <option value="bottom-left">Bawah Kiri</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                <Field.Root>
                  <Field.Label>Format Penomoran</Field.Label>
                  <NativeSelect.Root>
                    <NativeSelect.Field
                      value={numberFormat}
                      onChange={(e) => setNumberFormat(e.target.value)}
                    >
                      <option value="Halaman {n} dari {total}">Halaman 1 dari {totalPages}</option>
                      <option value="{n} / {total}">1 / {totalPages}</option>
                      <option value="{n}">1, 2, 3... (Angka saja)</option>
                      <option value="Hal. {n}">Hal. 1</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>

                <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                  <Field.Root>
                    <Field.Label>Ukuran Huruf</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={String(numberFontSize)}
                        onChange={(e) => setNumberFontSize(Number(e.target.value))}
                      >
                        <option value="10">10 pt (Kecil)</option>
                        <option value="12">12 pt (Standar)</option>
                        <option value="14">14 pt (Besar)</option>
                        <option value="16">16 pt (Ekstra)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Halaman Sampul</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={skipFirstPage ? "skip" : "include"}
                        onChange={(e) => setSkipFirstPage(e.target.value === "skip")}
                      >
                        <option value="include">Beri nomor semua halaman</option>
                        <option value="skip">Lewati halaman pertama (Sampul)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                </SimpleGrid>

                <Field.Root>
                  <Field.Label>Mulai Dari Angka</Field.Label>
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
                  <Field.Label>Teks Watermark</Field.Label>
                  <Input
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    placeholder="Contoh: CONFIDENTIAL / DRAFT / PT VUTEQ INDONESIA"
                  />
                </Field.Root>

                {/* Quick text chips */}
                <Flex wrap="wrap" gap="2">
                  {["CONFIDENTIAL", "DRAFT", "PT VUTEQ INDONESIA", "RAHASIA"].map((chip) => (
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
                    <Field.Label>Sudut Rotasi</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={String(watermarkRotation)}
                        onChange={(e) => setWatermarkRotation(Number(e.target.value))}
                      >
                        <option value="45">45° (Diagonal standar)</option>
                        <option value="0">0° (Horizontal rata)</option>
                        <option value="-45">-45° (Diagonal terbalik)</option>
                        <option value="90">90° (Vertikal tegak)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Transparansi (Opasitas)</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={String(watermarkOpacity)}
                        onChange={(e) => setWatermarkOpacity(Number(e.target.value))}
                      >
                        <option value="0.15">15% (Sangat Samar)</option>
                        <option value="0.3">30% (Standar Rekomendasi)</option>
                        <option value="0.5">50% (Sedang)</option>
                        <option value="0.7">70% (Tegas)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>
                </SimpleGrid>

                <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                  <Field.Root>
                    <Field.Label>Ukuran Font</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={String(watermarkFontSize)}
                        onChange={(e) => setWatermarkFontSize(Number(e.target.value))}
                      >
                        <option value="32">32 pt (Kecil)</option>
                        <option value="48">48 pt (Standar)</option>
                        <option value="64">64 pt (Besar)</option>
                        <option value="80">80 pt (Sangat Besar)</option>
                      </NativeSelect.Field>
                      <NativeSelect.Indicator />
                    </NativeSelect.Root>
                  </Field.Root>

                  <Field.Root>
                    <Field.Label>Warna Teks</Field.Label>
                    <NativeSelect.Root>
                      <NativeSelect.Field
                        value={watermarkColor}
                        onChange={(e) => setWatermarkColor(e.target.value as "gray" | "red" | "blue")}
                      >
                        <option value="gray">Abu-abu (Netral)</option>
                        <option value="red">Merah (Peringatan)</option>
                        <option value="blue">Biru (Formal)</option>
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
                    Format Output Otomatis
                  </Heading>
                  <Text fontSize="sm" color="fg.muted">
                    {totalPages === 1
                      ? "Dokumen memiliki 1 halaman. Hasil konversi akan diunduh langsung sebagai file gambar JPG berkualitas tinggi."
                      : `Dokumen memiliki ${totalPages} halaman. Setiap halaman akan dikonversi menjadi file gambar JPG dan dikemas otomatis ke dalam arsip ZIP.`}
                  </Text>
                </Box>
              </Stack>
            )}

            {/* Progress indicator */}
            {busy && (
              <Stack gap="2">
                <Flex justify="space-between" fontSize="sm">
                  <Text fontWeight="medium">{progressLabel || "Sedang memproses..."}</Text>
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
              {tool.slug === "rotate-pdf" && "Putar & Unduh PDF"}
              {tool.slug === "delete-pages" && "Hapus Halaman & Unduh PDF"}
              {tool.slug === "page-numbers" && "Beri Nomor & Unduh PDF"}
              {tool.slug === "watermark" && "Tambahkan Watermark & Unduh PDF"}
              {tool.slug === "pdf-to-jpg" && (totalPages > 1 ? "Konversi ke ZIP (JPG)" : "Konversi ke JPG")}
            </Button>
          </Stack>
        </Box>
      </SimpleGrid>
    </Stack>
  )
}
