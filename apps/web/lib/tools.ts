export type Tool = { slug: string; title: string; description: string; accept: string; multiple: boolean; option?: "ranges" | "password" | "preset" | "pageSize" }
export const tools: Tool[] = [
  { slug: "merge", title: "Gabungkan PDF", description: "Satukan beberapa PDF sesuai urutan.", accept: "application/pdf", multiple: true },
  { slug: "split", title: "Pisahkan PDF", description: "Ekstrak rentang halaman menjadi beberapa file.", accept: "application/pdf", multiple: false, option: "ranges" },
  { slug: "image-to-pdf", title: "Gambar ke PDF", description: "Ubah JPG, PNG, atau WebP menjadi PDF.", accept: "image/jpeg,image/png,image/webp", multiple: true, option: "pageSize" },
  { slug: "docx-to-pdf", title: "DOCX ke PDF", description: "Konversi dokumen Word secara headless.", accept: ".docx", multiple: false },
  { slug: "protect", title: "Lindungi PDF", description: "Enkripsi PDF dengan AES-256.", accept: "application/pdf", multiple: false, option: "password" },
  { slug: "compress", title: "Kompres PDF", description: "Kurangi ukuran dengan preset berkualitas.", accept: "application/pdf", multiple: false, option: "preset" },
]
export const toolBySlug = (slug: string) => tools.find((tool) => tool.slug === slug)
