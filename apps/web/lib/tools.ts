import type { LucideIcon } from "lucide-react"
import { Combine, FileImage, FileLock2, FileOutput, Files, Minimize2, PanelsTopLeft } from "lucide-react"

export type Tool = { slug: string; title: string; description: string; accept: string; multiple: boolean; local?: boolean; icon: LucideIcon; option?: "ranges" | "password" | "preset" | "pageSize" }
export const tools: Tool[] = [
  { slug: "organize", title: "Atur & Edit PDF", description: "Susun, hapus, dan putar halaman langsung di browser.", accept: "application/pdf", multiple: false, local: true, icon: PanelsTopLeft },
  { slug: "merge", title: "Gabungkan PDF", description: "Satukan beberapa PDF sesuai urutan yang Anda tentukan.", accept: "application/pdf", multiple: true, icon: Combine },
  { slug: "split", title: "Pisahkan PDF", description: "Ekstrak rentang halaman menjadi beberapa file.", accept: "application/pdf", multiple: false, option: "ranges", icon: Files },
  { slug: "image-to-pdf", title: "Gambar ke PDF", description: "Ubah JPG, PNG, atau WebP menjadi PDF berkualitas.", accept: "image/jpeg,image/png,image/webp", multiple: true, option: "pageSize", icon: FileImage },
  { slug: "docx-to-pdf", title: "DOCX ke PDF", description: "Konversi dokumen Word menjadi PDF.", accept: ".docx", multiple: false, icon: FileOutput },
  { slug: "protect", title: "Lindungi PDF", description: "Amankan PDF dengan enkripsi dan kata sandi.", accept: "application/pdf", multiple: false, option: "password", icon: FileLock2 },
  { slug: "compress", title: "Kompres PDF", description: "Kurangi ukuran file dengan kualitas terkendali.", accept: "application/pdf", multiple: false, option: "preset", icon: Minimize2 },
]
export const toolBySlug = (slug: string) => tools.find((tool) => tool.slug === slug)
