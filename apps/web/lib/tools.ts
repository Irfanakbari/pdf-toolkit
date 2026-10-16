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
    title: "Atur & Edit PDF",
    description: "Susun ulang, hapus, dan putar halaman PDF secara visual langsung di browser.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "organize",
    colorPalette: "purple",
    local: true,
    icon: PanelsTopLeft,
  },
  {
    slug: "rotate-pdf",
    title: "Putar PDF",
    description: "Putar orientasi halaman PDF 90°, 180°, atau 270° untuk seluruh atau halaman tertentu.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "organize",
    colorPalette: "blue",
    local: true,
    icon: RotateCw,
  },
  {
    slug: "delete-pages",
    title: "Hapus Halaman",
    description: "Hapus satu atau beberapa halaman yang tidak diinginkan dari file PDF Anda.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "organize",
    colorPalette: "red",
    local: true,
    icon: Trash2,
  },
  {
    slug: "page-numbers",
    title: "Beri Nomor Halaman",
    description: "Beri nomor halaman otomatis pada PDF dengan kustomisasi posisi, font, dan format.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "organize",
    colorPalette: "teal",
    local: true,
    icon: Hash,
  },
  {
    slug: "watermark",
    title: "Watermark Teks",
    description: "Tambahkan cap teks watermark diagonal transparan untuk keamanan dokumen.",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "security",
    colorPalette: "purple",
    local: true,
    icon: Stamp,
  },
  {
    slug: "pdf-to-jpg",
    title: "PDF ke Gambar",
    description: "Konversi setiap halaman PDF menjadi gambar JPG berkualitas (ZIP jika banyak halaman).",
    accept: "application/pdf,.pdf",
    multiple: false,
    category: "convert",
    colorPalette: "orange",
    local: true,
    icon: FileImage,
  },
  {
    slug: "merge",
    title: "Gabungkan PDF",
    description: "Satukan beberapa PDF sesuai urutan yang Anda tentukan.",
    accept: "application/pdf",
    multiple: true,
    category: "organize",
    colorPalette: "red",
    icon: Combine,
  },
  {
    slug: "split",
    title: "Pisahkan PDF",
    description: "Ekstrak halaman atau rentang tertentu menjadi beberapa file.",
    accept: "application/pdf",
    multiple: false,
    category: "organize",
    colorPalette: "orange",
    option: "ranges",
    icon: Files,
  },
  {
    slug: "image-to-pdf",
    title: "Gambar ke PDF",
    description: "Ubah JPG, PNG, atau WebP menjadi dokumen PDF.",
    accept: "image/jpeg,image/png,image/webp",
    multiple: true,
    category: "convert",
    colorPalette: "green",
    option: "pageSize",
    icon: FileImage,
  },
  {
    slug: "docx-to-pdf",
    title: "DOCX ke PDF",
    description: "Konversi dokumen Microsoft Word menjadi file PDF.",
    accept: ".docx",
    multiple: false,
    category: "convert",
    colorPalette: "blue",
    icon: FileOutput,
  },
  {
    slug: "compress",
    title: "Kompres PDF",
    description: "Kurangi ukuran file dengan pilihan kualitas yang sesuai.",
    accept: "application/pdf",
    multiple: false,
    category: "optimize",
    colorPalette: "teal",
    option: "preset",
    icon: Minimize2,
  },
  {
    slug: "protect",
    title: "Lindungi PDF",
    description: "Amankan dokumen PDF menggunakan enkripsi dan kata sandi.",
    accept: "application/pdf",
    multiple: false,
    category: "security",
    colorPalette: "blue",
    option: "password",
    icon: FileLock2,
  },
]

export const toolBySlug = (slug: string) => tools.find((tool) => tool.slug === slug)
