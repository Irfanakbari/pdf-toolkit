"use client"

import { ChangeEvent, useEffect, useState } from "react"
import {
  Box,
  Button,
  Field,
  Flex,
  Heading,
  IconButton,
  Input,
  NativeSelect,
  Progress,
  Stack,
  Text,
} from "@chakra-ui/react"
import { ArrowDown, ArrowUp, FileUp, X } from "lucide-react"

import { createJob, download, status, submit, upload } from "@/lib/api"
import type { Tool } from "@/lib/tools"

export function ToolWorkspace({
  tool,
}: {
  tool: Pick<Tool, "slug" | "title" | "description" | "accept" | "multiple" | "option" | "local">
}) {
  const [files, setFiles] = useState<File[]>([])
  const [option, setOption] = useState("")
  const [job, setJob] = useState<{ id: string; token: string; outputName?: string }>()
  const [state, setState] = useState("Ready")
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!job || !["Queued", "Processing", "Uploading"].includes(state)) return
    const timer = window.setInterval(async () => {
      try {
        const current = await status(job.id, job.token)
        setState(current.Status)
        setProgress(current.Progress)
        if (current.OutputName) {
          setJob((prev) => (prev ? { ...prev, outputName: current.OutputName } : prev))
        }
        if (current.Status === "Failed") {
          setError(`Processing failed (${current.ErrorCode ?? "unknown error"})`)
        }
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Failed to retrieve status")
      }
    }, 1500)
    return () => clearInterval(timer)
  }, [job, state])

  function pick(event: ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(event.target.files ?? []))
    setError("")
  }

  function move(index: number, direction: number) {
    const destination = index + direction
    if (destination < 0 || destination >= files.length) return
    const next = [...files]
    ;[next[index], next[destination]] = [next[destination], next[index]]
    setFiles(next)
  }

  async function process() {
    if (!files.length) return setError("Please select at least one file.")
    setBusy(true)
    setError("")
    try {
      const created = await createJob(tool.slug)
      setJob({ id: created.JobId, token: created.CapabilityToken })
      setState("Uploading")
      for (let index = 0; index < files.length; index++) {
        await upload(created.JobId, created.CapabilityToken, files[index])
        setProgress(Math.round(((index + 1) / files.length) * 30))
      }
      const options: Record<string, string> = {}
      if (tool.option === "ranges") options.Ranges = option || "1-"
      if (tool.option === "password") options.Password = option
      if (tool.option === "preset") options.Preset = option || "balanced"
      if (tool.option === "pageSize") options.PageSize = option || "A4"
      const queued = await submit(created.JobId, created.CapabilityToken, options)
      setState(queued.Status)
      setProgress(queued.Progress)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "An unexpected error occurred")
      setState("Failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Stack gap="7">
      <Stack
        align="center"
        borderWidth="2px"
        borderStyle="dashed"
        borderColor="teal.300"
        rounded="2xl"
        p={{ base: "8", md: "12" }}
        textAlign="center"
        bg="teal.subtle"
        gap="3"
      >
        <FileUp size={36} aria-hidden="true" />
        <Heading size="xl">Select files to process</Heading>
        <Text color="fg.muted">Maximum 100 MB per file and 500 MB per job.</Text>
        <Button as="label" colorPalette="teal" cursor="pointer">
          Choose Files
          <Input
            type="file"
            accept={tool.accept}
            multiple={tool.multiple}
            onChange={pick}
            position="absolute"
            opacity="0"
            width="1px"
            height="1px"
          />
        </Button>
      </Stack>

      {files.length > 0 && (
        <Stack gap="2" aria-label="Selected files">
          {files.map((file, index) => (
            <Flex
              key={`${file.name}-${index}`}
              bg="bg.panel"
              borderWidth="1px"
              rounded="xl"
              p="3"
              align="center"
              gap="2"
            >
              <Text flex="1" truncate fontWeight="medium">
                {file.name}
              </Text>
              <Text color="fg.muted" fontSize="sm">
                {(file.size / 1024 / 1024).toFixed(1)} MB
              </Text>
              {tool.multiple && (
                <>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Move up ${file.name}`}
                    onClick={() => move(index, -1)}
                  >
                    <ArrowUp />
                  </IconButton>
                  <IconButton
                    size="sm"
                    variant="ghost"
                    aria-label={`Move down ${file.name}`}
                    onClick={() => move(index, 1)}
                  >
                    <ArrowDown />
                  </IconButton>
                </>
              )}
              <IconButton
                size="sm"
                variant="ghost"
                colorPalette="red"
                aria-label={`Remove ${file.name}`}
                onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))}
              >
                <X />
              </IconButton>
            </Flex>
          ))}
        </Stack>
      )}

      {tool.option && <OptionField type={tool.option} value={option} setValue={setOption} />}

      {error && (
        <Text role="alert" aria-live="assertive" color="red.fg">
          {error}
        </Text>
      )}

      {state !== "Completed" && (
        <Button
          colorPalette="teal"
          size="lg"
          onClick={process}
          loading={busy}
          disabled={busy || ["Queued", "Processing", "Uploading"].includes(state)}
        >
          Process {tool.title}
        </Button>
      )}

      {state !== "Ready" && (
        <Box>
          <Flex justify="space-between" mb="2">
            <Text fontWeight="medium">{state}</Text>
            <Text>{progress}%</Text>
          </Flex>
          <Progress.Root value={progress} colorPalette="teal">
            <Progress.Track>
              <Progress.Range />
            </Progress.Track>
          </Progress.Root>
        </Box>
      )}

      {state === "Completed" && job && (
        <Button
          colorPalette="teal"
          size="lg"
          onClick={() => download(job.id, job.token, job.outputName || files[0]?.name || "document.pdf")}
        >
          Download Document
        </Button>
      )}
    </Stack>
  )
}

function OptionField({
  type,
  value,
  setValue,
}: {
  type: NonNullable<Tool["option"]>
  value: string
  setValue: (value: string) => void
}) {
  const labels = {
    ranges: "Page ranges",
    password: "Password",
    preset: "Compression preset",
    pageSize: "Page size",
  }

  if (type === "preset" || type === "pageSize") {
    return (
      <Field.Root>
        <Field.Label>{labels[type]}</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={value || (type === "preset" ? "balanced" : "A4")}
            onChange={(event) => setValue(event.target.value)}
          >
            {(type === "preset"
              ? [
                  ["screen", "Small file size"],
                  ["balanced", "Balanced"],
                  ["print", "High print quality"],
                ]
              : [
                  ["A4", "A4"],
                  ["Letter", "Letter"],
                ]
            ).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </NativeSelect.Field>
          <NativeSelect.Indicator />
        </NativeSelect.Root>
      </Field.Root>
    )
  }

  return (
    <Field.Root required={type === "password"}>
      <Field.Label>{labels[type]}</Field.Label>
      <Input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        type={type === "password" ? "password" : "text"}
        placeholder={type === "ranges" ? "e.g., 1-3, 5, 8-" : "Minimum 8 characters"}
        minLength={type === "password" ? 8 : undefined}
      />
    </Field.Root>
  )
}
