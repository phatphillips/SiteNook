import type PocketBase from 'pocketbase'

export type OdlConvertFormats = string

export interface OdlStructureResult {
  formats: string[]
  json: string
  html: string
  markdown: string
}

export interface OdlTaggedResult extends OdlStructureResult {
  taggedPdf: Buffer
}

function odlBaseUrl(): string {
  return (process.env.OPENDATALOADER_URL || 'http://opendataloader:8095').replace(/\/$/, '')
}

async function postConvert(
  buffer: Buffer,
  filename: string,
  format: OdlConvertFormats
): Promise<Response> {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)], { type: 'application/pdf' }), filename || 'document.pdf')
  form.append('format', format)

  const response = await fetch(`${odlBaseUrl()}/api/convert`, {
    method: 'POST',
    body: form
  })
  return response
}

export async function convertPdfStructure(
  buffer: Buffer,
  filename: string,
  format: OdlConvertFormats = 'json,html,markdown'
): Promise<OdlStructureResult> {
  const response = await postConvert(buffer, filename, format)
  const body = await response.json().catch(() => ({})) as {
    error?: string
    formats?: string[]
    json?: string
    html?: string
    markdown?: string
  }
  if (!response.ok) {
    throw new Error(body.error || `OpenDataLoader convert failed (${response.status})`)
  }
  return {
    formats: body.formats ?? format.split(',').map(s => s.trim()),
    json: body.json ?? '',
    html: body.html ?? '',
    markdown: body.markdown ?? ''
  }
}

export async function convertPdfTagged(
  buffer: Buffer,
  filename: string,
  format: OdlConvertFormats = 'json,html,markdown,tagged-pdf'
): Promise<OdlTaggedResult> {
  const response = await postConvert(buffer, filename, format)
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new Error(body.error || `OpenDataLoader tagged convert failed (${response.status})`)
  }

  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/zip') || contentType.includes('application/octet-stream')) {
    const zipBuf = Buffer.from(await response.arrayBuffer())
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(zipBuf)
    const taggedEntry =
      zip.file('suggested-tagged.pdf') ||
      Object.values(zip.files).find(f => !f.dir && f.name.toLowerCase().endsWith('.pdf'))
    if (!taggedEntry) {
      throw new Error('OpenDataLoader zip missing tagged PDF')
    }
    const taggedPdf = Buffer.from(await taggedEntry.async('nodebuffer'))
    const readText = async (name: string) => {
      const file = zip.file(name)
      return file ? await file.async('string') : ''
    }
    return {
      formats: format.split(',').map(s => s.trim()),
      json: await readText('structure.json'),
      html: await readText('structure.html'),
      markdown: await readText('structure.md'),
      taggedPdf
    }
  }

  // Fallback: some deployments may return JSON with base64 (not expected from our sidecar)
  throw new Error('OpenDataLoader tagged response was not a zip artifact')
}

export async function pingOpenDataLoader(): Promise<boolean> {
  try {
    const response = await fetch(`${odlBaseUrl()}/health`)
    return response.ok
  } catch {
    return false
  }
}
