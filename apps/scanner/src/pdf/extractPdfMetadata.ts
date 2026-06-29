import { PDFParse } from 'pdf-parse'

export const TEXT_CONTENT_MAX = 500_000

export interface PdfPageDimension {
  width: number
  height: number
  unit: 'pt'
}

export interface PdfMetadata {
  title?: string
  author?: string
  subject?: string
  keywords?: string
  creationDate?: string
  modificationDate?: string
  creator?: string
  producer?: string
  pdfVersion?: string
  pageCount?: number
  pageDimensions?: PdfPageDimension[]
  linearized?: boolean
  hasTags?: boolean
  taggedForAccessibility?: boolean
  pdfUa?: boolean
  pdfA?: string | null
}

export interface ExtractedPdfContent {
  metadata: PdfMetadata
  textContent: string
}

export interface ExtractPdfMetadataOptions {
  hasPdfTags?: boolean
  machineReadable?: boolean
  pdfUa?: boolean
}

function normalizeString(value: unknown): string | undefined {
  if (value == null) return undefined
  const s = String(value).trim()
  return s || undefined
}

function normalizePdfDate(value: unknown): string | undefined {
  if (value == null) return undefined
  const s = String(value).trim()
  return s || undefined
}

export function parsePdfVersion(buffer: Buffer): string | undefined {
  const head = buffer.subarray(0, 1024).toString('latin1')
  const match = head.match(/%PDF-(\d+\.\d+)/)
  return match?.[1]
}

export function isLinearized(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 8192)).toString('latin1')
  return /\/Linearized\s+(?:true|1)/i.test(sample)
}

function parseXmpValue(buffer: Buffer, tag: string): string | undefined {
  const text = buffer.toString('latin1')
  const patterns = [
    new RegExp(`<dc:${tag}[^>]*>\\s*<rdf:Alt>\\s*<rdf:li[^>]*>([^<]*)</rdf:li>`, 'i'),
    new RegExp(`<dc:${tag}[^>]*>([^<]*)</dc:${tag}>`, 'i')
  ]
  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return undefined
}

function parsePdfA(buffer: Buffer): string | null {
  const text = buffer.toString('latin1')
  const part = text.match(/pdfaid:part[^>]*>(\d+)</i)?.[1]
  if (part) return `PDF/A-${part}`
  return null
}

function parseFirstMediaBox(buffer: Buffer): PdfPageDimension | undefined {
  const text = buffer.toString('latin1')
  const match = text.match(/\/MediaBox\s*\[\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\]/)
  if (!match) return undefined
  const x1 = Number.parseFloat(match[1]!)
  const y1 = Number.parseFloat(match[2]!)
  const x2 = Number.parseFloat(match[3]!)
  const y2 = Number.parseFloat(match[4]!)
  if (!Number.isFinite(x1) || !Number.isFinite(y1) || !Number.isFinite(x2) || !Number.isFinite(y2)) {
    return undefined
  }
  return {
    width: Math.round(x2 - x1),
    height: Math.round(y2 - y1),
    unit: 'pt'
  }
}

export async function extractPdfMetadata(
  buffer: Buffer,
  options?: ExtractPdfMetadataOptions
): Promise<ExtractedPdfContent> {
  let pageCount: number | undefined
  let info: Record<string, unknown> = {}
  let textContent = ''

  const parser = new PDFParse({ data: buffer })
  try {
    const infoResult = await parser.getInfo()
    pageCount = infoResult.total || undefined
    info = (infoResult.info ?? {}) as Record<string, unknown>

    const textResult = await parser.getText()
    textContent = (textResult.text || '').slice(0, TEXT_CONTENT_MAX)
  } catch (err) {
    console.warn('PDF text/metadata extraction failed:', err instanceof Error ? err.message : err)
    pageCount = undefined
    info = {}
    textContent = ''
  } finally {
    await parser.destroy().catch(() => {})
  }

  const mediaBox = parseFirstMediaBox(buffer)

  const metadata: PdfMetadata = {
    title: normalizeString(info.Title) || parseXmpValue(buffer, 'title'),
    author: normalizeString(info.Author) || parseXmpValue(buffer, 'creator'),
    subject: normalizeString(info.Subject) || parseXmpValue(buffer, 'subject'),
    keywords: normalizeString(info.Keywords),
    creationDate: normalizePdfDate(info.CreationDate),
    modificationDate: normalizePdfDate(info.ModDate),
    creator: normalizeString(info.Creator),
    producer: normalizeString(info.Producer),
    pdfVersion: parsePdfVersion(buffer),
    pageCount,
    pageDimensions: mediaBox ? [mediaBox] : undefined,
    linearized: isLinearized(buffer),
    hasTags: options?.hasPdfTags,
    taggedForAccessibility: options?.machineReadable,
    pdfUa: options?.pdfUa,
    pdfA: parsePdfA(buffer)
  }

  return { metadata, textContent }
}
