const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
export type Job = { JobId: string; Status: string; Progress: number; OutputName?: string; ErrorCode?: string }
type Created = { JobId: string; CapabilityToken: string }
const headers = (token: string) => ({ "X-Capability-Token": token })
export async function createJob(tool: string): Promise<Created> { const response = await fetch(`${base}/api/v1/jobs`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ Tool: tool }) }); return checked(response) }
export async function upload(jobId: string, token: string, file: File) { const data = new FormData(); data.append("file", file); return checked(await fetch(`${base}/api/v1/jobs/${jobId}/files`, { method: "POST", headers: headers(token), body: data })) }
export async function submit(jobId: string, token: string, options: Record<string, string>) { return checked(await fetch(`${base}/api/v1/jobs/${jobId}/submit`, { method: "POST", headers: { ...headers(token), "Content-Type": "application/json" }, body: JSON.stringify({ Options: options }) })) }
export async function status(jobId: string, token: string): Promise<Job> { return checked(await fetch(`${base}/api/v1/jobs/${jobId}`, { headers: headers(token), cache: "no-store" })) }
export async function download(jobId: string, token: string) { const response = await fetch(`${base}/api/v1/jobs/${jobId}/download`, { headers: headers(token) }); if (!response.ok) throw new Error("Unduhan gagal"); const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = response.headers.get("content-disposition")?.match(/filename="?([^";]+)"?/)?.[1] ?? "hasil.pdf"; link.click(); URL.revokeObjectURL(url) }
async function checked(response: Response) { const data = await response.json(); if (!response.ok) throw new Error(data.Error?.Message ?? data.detail?.Message ?? "Permintaan gagal"); return data }
