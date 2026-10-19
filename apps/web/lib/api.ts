const base = process.env.NEXT_PUBLIC_API_URL ?? "/pdf-tools/backend"

export type Job = {
  JobId: string
  Status: string
  Progress: number
  Stage?: string
  OutputName?: string
  ErrorCode?: string
}

type Created = { JobId: string; CapabilityToken: string }
type RequestStage = "create job" | "upload file" | "submit job" | "retrieve status" | "download result"

const headers = (token: string) => ({ "X-Capability-Token": token })

async function apiFetch(path: string, stage: RequestStage, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${base}${path}`, init)
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : "Network connection failed"
    throw new Error(`Unable to ${stage}. The connection to the PDF processing service was interrupted. (${detail})`)
  }
}

export async function createJob(tool: string): Promise<Created> {
  const response = await apiFetch("/api/v1/jobs", "create job", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Tool: tool }),
  })
  return checked<Created>(response)
}

export async function upload(jobId: string, token: string, file: File) {
  const data = new FormData()
  data.append("file", file)
  return checked<Job>(
    await apiFetch(`/api/v1/jobs/${jobId}/files`, "upload file", {
      method: "POST",
      headers: headers(token),
      body: data,
    }),
  )
}

export async function submit(jobId: string, token: string, options: Record<string, string>) {
  return checked<Job>(
    await apiFetch(`/api/v1/jobs/${jobId}/submit`, "submit job", {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ Options: options }),
    }),
  )
}

export async function status(jobId: string, token: string): Promise<Job> {
  return checked<Job>(
    await apiFetch(`/api/v1/jobs/${jobId}`, "retrieve status", {
      headers: headers(token),
      cache: "no-store",
    }),
  )
}

export async function download(
  jobId: string,
  token: string,
  jobOrFallback?: { OutputName?: string } | string,
) {
  const response = await apiFetch(`/api/v1/jobs/${jobId}/download`, "download result", {
    headers: headers(token),
  })
  if (!response.ok) throw new Error("Unable to download the processed document")
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url

  const disposition = response.headers.get("content-disposition")
  let filename = ""
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
    if (match?.[1]) filename = decodeURIComponent(match[1].trim())
  }

  const fallback =
    typeof jobOrFallback === "string"
      ? jobOrFallback
      : (jobOrFallback?.OutputName || "")
  let chosen = filename || fallback || "document.pdf"

  const contentType = response.headers.get("content-type") || ""
  if (contentType.includes("zip") && !chosen.toLowerCase().endsWith(".zip")) {
    chosen = chosen.replace(/\.[^.]+$/, "") + ".zip"
  } else if (contentType.includes("pdf") && !chosen.toLowerCase().endsWith(".pdf")) {
    chosen = chosen.replace(/\.[^.]+$/, "") + ".pdf"
  } else if (contentType.includes("wordprocessingml") && !chosen.toLowerCase().endsWith(".docx")) {
    chosen = chosen.replace(/\.[^.]+$/, "") + ".docx"
  } else if (contentType.includes("spreadsheetml") && !chosen.toLowerCase().endsWith(".xlsx")) {
    chosen = chosen.replace(/\.[^.]+$/, "") + ".xlsx"
  } else if (contentType.includes("presentationml") && !chosen.toLowerCase().endsWith(".pptx")) {
    chosen = chosen.replace(/\.[^.]+$/, "") + ".pptx"
  }

  link.download = chosen
  link.click()
  URL.revokeObjectURL(url)
}

async function checked<T>(response: Response): Promise<T> {
  let data: Record<string, unknown>
  try {
    data = (await response.json()) as Record<string, unknown>
  } catch {
    if (!response.ok) throw new Error(`Processing API returned HTTP ${response.status}`)
    throw new Error("Processing API returned an invalid response")
  }
  if (!response.ok) {
    const errorObj = data.Error as { Message?: string } | undefined
    const detailObj = data.detail as { Message?: string } | undefined
    const msg = errorObj?.Message ?? detailObj?.Message ?? `Request failed with HTTP ${response.status}`
    throw new Error(msg)
  }
  return data as T
}
