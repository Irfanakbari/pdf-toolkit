import type { LucideIcon } from "lucide-react"
import {
  Combine,
  FileImage,
  FileLock2,
  FileOutput,
  Files,
  Hash,
  Minimize2,
  PanelsTopLeft,
  RotateCw,
  Stamp,
  Trash2,
} from "lucide-react"

export type ToolCategory = "organize" | "convert" | "optimize" | "security"
export type ToolPalette = "blue" | "green" | "orange" | "purple" | "red" | "teal"

export type Tool = {
  slug: string
  title: string
  description: string
  accept: string
  multiple: boolean
  category: ToolCategory
  colorPalette: ToolPalette
  local?: boolean
  icon: LucideIcon
  option?: "ranges" | "password" | "preset" | "pageSize"
}

export const tools: Tool[] = [
  {
    slug: "organize",
    title: "Organize & Edit PDF",
    description: "Rearrange, rotate, and delete PDF pages directly in your browser.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "organize",
    colorPalette: "purple",
    local: true,
    icon: PanelsTopLeft,
  },
  {
    slug: "rotate-pdf",
    title: "Rotate PDF",
    description: "Rotate your PDF pages 90°, 180°, or 270° for all or specific pages.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "organize",
    colorPalette: "blue",
    local: true,
    icon: RotateCw,
  },
  {
    slug: "delete-pages",
    title: "Delete Pages",
    description: "Remove unwanted pages or custom page ranges from your PDF file.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "organize",
    colorPalette: "red",
    local: true,
    icon: Trash2,
  },
  {
    slug: "page-numbers",
    title: "Page Numbers",
    description: "Add automated page numbers with customizable position and font.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "organize",
    colorPalette: "teal",
    local: true,
    icon: Hash,
  },
  {
    slug: "watermark",
    title: "Text Watermark",
    description: "Stamp a diagonal semi-transparent text watermark across your pages.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "security",
    colorPalette: "purple",
    local: true,
    icon: Stamp,
  },
  {
    slug: "pdf-to-jpg",
    title: "PDF to JPG",
    description: "Convert every PDF page into high-quality JPG images (ZIP if multiple).",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "convert",
    colorPalette: "orange",
    local: true,
    icon: FileImage,
  },
  {
    slug: "merge",
    title: "Merge PDF",
    description: "Combine multiple PDF files into a single unified document.",
    accept: "application/pdf",
    multiple: true,
    category: "organize",
    colorPalette: "red",
    icon: Combine,
  },
  {
    slug: "split",
    title: "Split PDF",
    description: "Extract specific pages or page ranges from your PDF document.",
    accept: "application/pdf",
    multiple: false,
    category: "organize",
    colorPalette: "orange",
    option: "ranges",
    icon: Files,
  },
  {
    slug: "image-to-pdf",
    title: "Image to PDF",
    description: "Convert JPG, PNG, or WebP images into a high-quality PDF document.",
    accept: "image/jpeg,image/png,image/webp",
    multiple: true,
    category: "convert",
    colorPalette: "green",
    option: "pageSize",
    icon: FileImage,
  },
  {
    slug: "docx-to-pdf",
    title: "Word to PDF",
    description: "Convert Microsoft Word DOCX documents into clean PDF files.",
    accept: ".docx",
    multiple: false,
    category: "convert",
    colorPalette: "blue",
    icon: FileOutput,
  },
  {
    slug: "compress",
    title: "Compress PDF",
    description: "Reduce file size while retaining optimal visual and document quality.",
    accept: "application/pdf",
    multiple: false,
    category: "optimize",
    colorPalette: "teal",
    option: "preset",
    icon: Minimize2,
  },
  {
    slug: "protect",
    title: "Protect PDF",
    description: "Secure and encrypt your PDF document with strong password protection.",
    accept: "application/pdf",
    multiple: false,
    category: "security",
    colorPalette: "blue",
    option: "password",
    icon: FileLock2,
  },
]

export const toolBySlug = (slug: string) => tools.find((tool) => tool.slug === slug)
