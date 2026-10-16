import type { LucideIcon } from "lucide-react"
import { Combine, FileImage, FileLock2, FileOutput, Files, Minimize2, PanelsTopLeft } from "lucide-react"

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
  { slug: "organize", title: "Atur & Edit PDF", description: "Susun ulang, hapus, dan putar halaman PDF langsung di browser.", accept: "application/pdf", multiple: false, category: "organize", colorPalette: "purple", local: true, icon: PanelsTopLeft },
  { slug: "merge", title: "Gabungkan PDF", description: "Satukan beberapa PDF sesuai urutan yang Anda tentukan.", accept: "application/pdf", multiple: true, category: "organize", colorPalette: "red", icon: Combine },
  { slug: "split", title: "Pisahkan PDF", description: "Ekstrak halaman atau rentang tertentu menjadi beberapa file.", accept: "application/pdf", multiple: false, category: "organize", colorPalette: "orange", option: "ranges", icon: Files },
  { slug: "image-to-pdf", title: "Gambar ke PDF", description: "Ubah JPG, PNG, atau WebP menjadi dokumen PDF.", accept: "image/jpeg,image/png,image/webp", multiple: true, category: "convert", colorPalette: "green", option: "pageSize", icon: FileImage },
  { slug: "docx-to-pdf", title: "DOCX ke PDF", description: "Konversi dokumen Microsoft Word menjadi file PDF.", accept: ".docx", multiple: false, category: "convert", colorPalette: "blue", icon: FileOutput },
  { slug: "compress", title: "Kompres PDF", description: "Kurangi ukuran file dengan pilihan kualitas yang sesuai.", accept: "application/pdf", multiple: false, category: "optimize", colorPalette: "teal", option: "preset", icon: Minimize2 },
  { slug: "protect", title: "Lindungi PDF", description: "Amankan dokumen PDF menggunakan enkripsi dan kata sandi.", accept: "application/pdf", multiple: false, category: "security", colorPalette: "blue", option: "password", icon: FileLock2 },
]

export const toolBySlug = (slug: string) => tools.find((tool) => tool.slug === slug)
