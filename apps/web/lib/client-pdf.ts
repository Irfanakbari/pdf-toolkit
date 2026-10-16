import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib"

export function getFileStem(filename: string): string {
  if (!filename) return "document"
  const clean = filename.trim()
  const lastDot = clean.lastIndexOf(".")
  if (lastDot <= 0) return clean || "document"
  return clean.substring(0, lastDot) || "document"
}

export function formatClientFileName(originalName: string, targetExtension: "pdf" | "jpg" | "zip"): string {
  const stem = getFileStem(originalName)
  return `${stem}.${targetExtension}`
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename || "document.pdf"
  link.click()
  URL.revokeObjectURL(url)
}

export function parsePageRanges(input: string, totalPages: number): number[] {
  if (!input || !input.trim()) return []
  const pages = new Set<number>()
  const parts = input.split(",").map((p) => p.trim()).filter(Boolean)

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-").map((s) => s.trim())
      const start = startStr ? parseInt(startStr, 10) : 1
      const end = endStr ? parseInt(endStr, 10) : totalPages

      if (!isNaN(start) && !isNaN(end)) {
        const from = Math.max(1, Math.min(start, end))
        const to = Math.min(totalPages, Math.max(start, end))
        for (let i = from; i <= to; i++) {
          pages.add(i)
        }
      }
    } else {
      const page = parseInt(part, 10)
      if (!isNaN(page) && page >= 1 && page <= totalPages) {
        pages.add(page)
      }
    }
  }

  return Array.from(pages).sort((a, b) => a - b)
}

export async function rotatePdfDocument(
  sourceBytes: ArrayBuffer,
  options: {
    degrees: 90 | 180 | 270
    scope: "all" | "custom"
    rangeText?: string
  },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes)
  const total = doc.getPageCount()
  const targetPages =
    options.scope === "all"
      ? Array.from({ length: total }, (_, i) => i + 1)
      : parsePageRanges(options.rangeText ?? "", total)

  if (targetPages.length === 0) {
    throw new Error("Select at least one valid page to rotate.")
  }

  for (const pageNum of targetPages) {
    const page = doc.getPage(pageNum - 1)
    const currentRotation = page.getRotation().angle
    page.setRotation(degrees((currentRotation + options.degrees) % 360))
  }

  return await doc.save()
}

export async function deletePdfDocumentPages(
  sourceBytes: ArrayBuffer,
  rangeText: string,
): Promise<Uint8Array> {
  const sourceDoc = await PDFDocument.load(sourceBytes)
  const total = sourceDoc.getPageCount()
  const pagesToDelete = new Set(parsePageRanges(rangeText, total))

  if (pagesToDelete.size === 0) {
    throw new Error("Enter pages to delete (e.g., 1, 3-5).")
  }
  if (pagesToDelete.size >= total) {
    throw new Error("Cannot delete all pages. Leave at least one page.")
  }

  const keepIndices: number[] = []
  for (let i = 1; i <= total; i++) {
    if (!pagesToDelete.has(i)) {
      keepIndices.push(i - 1)
    }
  }

  const outputDoc = await PDFDocument.create()
  const copiedPages = await outputDoc.copyPages(sourceDoc, keepIndices)
  for (const page of copiedPages) {
    outputDoc.addPage(page)
  }

  return await outputDoc.save()
}

export async function addPageNumbersToPdf(
  sourceBytes: ArrayBuffer,
  options: {
    position: "bottom-center" | "bottom-right" | "bottom-left"
    fontSize: number
    format: string
    startNumber: number
    skipFirstPage: boolean
  },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes)
  const total = doc.getPageCount()
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const fontSize = options.fontSize || 12

  for (let i = 0; i < total; i++) {
    if (i === 0 && options.skipFirstPage) continue

    const page = doc.getPage(i)
    const { width } = page.getSize()
    const pageNum = options.startNumber + (options.skipFirstPage ? i - 1 : i)
    const text = options.format
      .replace("{n}", String(pageNum))
      .replace("{total}", String(options.skipFirstPage ? total - 1 : total))

    const textWidth = font.widthOfTextAtSize(text, fontSize)
    let x = (width - textWidth) / 2
    if (options.position === "bottom-right") {
      x = width - textWidth - 36
    } else if (options.position === "bottom-left") {
      x = 36
    }
    const y = 24

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color: rgb(0.2, 0.2, 0.2),
    })
  }

  return await doc.save()
}

export async function addWatermarkToPdf(
  sourceBytes: ArrayBuffer,
  options: {
    text: string
    rotation: number
    opacity: number
    fontSize: number
    color: "gray" | "red" | "blue"
  },
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(sourceBytes)
  const total = doc.getPageCount()
  const font = await doc.embedFont(StandardFonts.HelveticaBold)
  const fontSize = options.fontSize || 48
  const text = options.text.trim()
  if (!text) throw new Error("Watermark text cannot be empty.")

  const colorMap = {
    gray: rgb(0.45, 0.45, 0.45),
    red: rgb(0.85, 0.15, 0.15),
    blue: rgb(0.15, 0.35, 0.85),
  }
  const color = colorMap[options.color] ?? colorMap.gray
  const rotationDegrees = options.rotation
  const rad = (rotationDegrees * Math.PI) / 180

  for (let i = 0; i < total; i++) {
    const page = doc.getPage(i)
    const { width, height } = page.getSize()
    const textWidth = font.widthOfTextAtSize(text, fontSize)
    const textHeight = font.heightAtSize(fontSize)

    const x = width / 2 - (textWidth / 2) * Math.cos(rad) + (textHeight / 2) * Math.sin(rad)
    const y = height / 2 - (textWidth / 2) * Math.sin(rad) - (textHeight / 2) * Math.cos(rad)

    page.drawText(text, {
      x,
      y,
      size: fontSize,
      font,
      color,
      opacity: options.opacity,
      rotate: degrees(rotationDegrees),
    })
  }

  return await doc.save()
}

export async function convertPdfToJpg(
  sourceBytes: ArrayBuffer,
  onProgress?: (current: number, total: number) => void,
): Promise<{ singleImage?: Blob; zipBlob?: Blob; totalPages: number }> {
  const pdfjs = await import("pdfjs-dist")
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString()

  const loaded = await pdfjs.getDocument({ data: sourceBytes.slice(0) }).promise
  const total = loaded.numPages
  const imageBlobs: Blob[] = []

  for (let i = 1; i <= total; i++) {
    const page = await loaded.getPage(i)
    const viewport = page.getViewport({ scale: 2.0 })
    const canvas = document.createElement("canvas")
    canvas.width = viewport.width
    canvas.height = viewport.height
    const context = canvas.getContext("2d")
    if (!context) throw new Error("Gagal menginisialisasi canvas untuk rendering.")

    await page.render({ canvas, canvasContext: context, viewport }).promise

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => {
          if (b) resolve(b)
          else reject(new Error(`Failed to render page ${i}`))
        },
        "image/jpeg",
        0.92,
      )
    })
    imageBlobs.push(blob)
    onProgress?.(i, total)
  }

  if (total === 1) {
    return { singleImage: imageBlobs[0], totalPages: 1 }
  }

  const JSZip = (await import("jszip")).default
  const zip = new JSZip()
  for (let i = 0; i < imageBlobs.length; i++) {
    const pad = String(i + 1).padStart(String(total).length, "0")
    zip.file(`page-${pad}.jpg`, imageBlobs[i])
  }

  const zipBlob = await zip.generateAsync({ type: "blob" })
  return { zipBlob, totalPages: total }
}
