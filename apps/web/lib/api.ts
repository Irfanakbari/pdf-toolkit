const base = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"

export type Job = {
  JobId: string
  Status: string
  Progress: number
  OutputName?: string
  ErrorCode?: string
}

type Created = { JobId: string; CapabilityToken: string }

const headers = (token: string) => ({ "X-Capability-Token": token })

export async function createJob(tool: string): Promise<Created> {
  const response = await fetch(`${base}/api/v1/jobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ Tool: tool }),
  })
  return checked(response)
}

export async function upload(jobId: string, token: string, file: File) {
  const data = new FormData()
  data.append("file", file)
  return checked(
    await fetch(`${base}/api/v1/jobs/${jobId}/files`, {
      method: "POST",
      headers: headers(token),
      body: data,
    }),
  )
}

export async function submit(jobId: string, token: string, options: Record<string, string>) {
  return checked(
    await fetch(`${base}/api/v1/jobs/${jobId}/submit`, {
      method: "POST",
      headers: { ...headers(token), "Content-Type": "application/json" },
      body: JSON.stringify({ Options: options }),
    }),
  )
}

export async function status(jobId: string, token: string): Promise<Job> {
  return checked(
    await fetch(`${base}/api/v1/jobs/${jobId}`, {
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
  const response = await fetch(`${base}/api/v1/jobs/${jobId}/download`, {
    headers: headers(token),
  })
  if (!response.ok) throw new Error("Download failed")
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url

  const disposition = response.headers.get("content-disposition")
  let filename = ""
  if (disposition) {
    const match = disposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i)
    if (match?.[1]) {
      filename = decodeURIComponent(match[1].trim())
    }
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

async function checked(response: Response) {
  const data = await response.json()
  if (!response.ok) {
    throw new Error(data.Error?.Message ?? data.detail?.Message ?? "Request failed")
  }
  return data
}
