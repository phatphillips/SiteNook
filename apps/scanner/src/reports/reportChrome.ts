import { PDFDocument, rgb, StandardFonts, type PDFPage } from 'pdf-lib'
import { PDFParse } from 'pdf-parse'

import type { ReportDataSectionKey, ReportOverviewSectionKey } from './types.js'
import { REPORT_DATA_SECTION_LABELS, REPORT_OVERVIEW_SECTION_LABELS } from './types.js'

/** Hidden text markers embedded in HTML so we can map PDF pages → sections. */
export const SECTION_MARKER_PREFIX = '%%AIQSEC:'
export const SECTION_MARKER_SUFFIX = '%%'

export const REPORT_COLORS = {
  /** Solid header / cover primary */
  navy: '#0B1F3A',
  navyMid: '#143A66',
  navySoft: '#1B4F8C',
  /** Light fills for table headers and chips */
  navyLight: '#E8EEF6',
  ink: '#0E1116',
  logoPill: '#061525',
  /** Blue accents / highlights */
  accent: '#2B6CB0',
  blue: '#3D5CC7',
  /** @deprecated aliases kept so older CSS refs keep compiling during polish */
  mintTop: '#0B1F3A',
  mintLight: '#E8EEF6',
  teal: '#2B6CB0',
  tealDark: '#1E4E8C',
  gray: '#6B7280',
  softGray: '#9AA4B2',
  border: '#D7DEE8',
  critical: '#D8342A',
  serious: '#E88B1A',
  moderate: '#7A5AF8',
  minor: '#6B7280',
  white: '#FFFFFF',
  zebra: '#F7F9FC'
} as const

export interface ReportChromeOptions {
  orgName: string
  scopeLabel: string
  generatedAtLabel: string
}

export interface SectionPageInfo {
  /** 1-based PDF page index where the section starts */
  startPage: number
  eyebrow: string
  sectionId: string
}

const TOC_DESCRIPTIONS: Record<string, string> = {
  'section-executive-summary': 'Headline scores and the top issues to prioritise.',
  'section-overview-accessibility': 'Score trend, conformance levels and issue severity.',
  'section-overview-qa': 'Broken links, spelling, and quality checks at a glance.',
  'section-overview-seo': 'Search performance, crawlability and content health.',
  'section-overview-orgSummary': 'Per-site scores and open issue counts across your organization.',
  'section-accessibility-issues': 'Full issue list with affected pages and occurrences.',
  'section-accessibility-pages': 'Per-page accessibility scores and open issue counts.',
  'section-accessibility-readability': 'Readability scores across scanned pages.',
  'section-accessibility-pdfs': 'PDF accessibility validation results.',
  'section-qa-links': 'Broken and suspicious links found during the crawl.',
  'section-qa-spelling': 'Spelling findings from page content.',
  'section-qa-inventory': 'Discovered pages, documents, and media assets.',
  'section-seo-technical': 'Technical SEO issues from the latest scans.',
  'section-seo-content': 'Content SEO findings and recommendations.'
}

export function tocDescriptionForSectionId(sectionId: string): string {
  return TOC_DESCRIPTIONS[sectionId] || 'Section details from the latest completed scans.'
}

export function eyebrowForExecutiveSummary(): string {
  return 'Executive summary'
}

export function eyebrowForToc(): string {
  return 'Table of contents'
}

export function eyebrowForOverviewSection(key: ReportOverviewSectionKey): string {
  return REPORT_OVERVIEW_SECTION_LABELS[key]
}

export function eyebrowForDataSection(key: ReportDataSectionKey): string {
  return REPORT_DATA_SECTION_LABELS[key]
}

export function renderSectionMarker(eyebrow: string, sectionId: string): string {
  const safeEyebrow = eyebrow.replace(/%/g, '')
  const safeId = sectionId.replace(/%/g, '')
  return `<span class="aiq-section-marker" data-section-id="${escapeAttr(safeId)}" data-eyebrow="${escapeAttr(safeEyebrow)}" aria-hidden="true">${SECTION_MARKER_PREFIX}${escapeHtml(safeEyebrow)}|${escapeHtml(safeId)}${SECTION_MARKER_SUFFIX}</span>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeAttr(value: string): string {
  return escapeHtml(value)
}

function hexToRgb(hex: string): { r: number, g: number, b: number } {
  const normalized = hex.replace('#', '')
  const value = Number.parseInt(normalized, 16)
  return {
    r: ((value >> 16) & 255) / 255,
    g: ((value >> 8) & 255) / 255,
    b: (value & 255) / 255
  }
}

const MARKER_RE = /%%AIQSEC:\s*([^|%]+?)\s*\|\s*([^%]+?)%%/g

export async function extractSectionPageMap(
  pdfBytes: Buffer,
  options: { treatFirstPageAsCover?: boolean } = {}
): Promise<{
  totalPages: number
  /** 0-based page index → eyebrow label */
  eyebrowsByPage: string[]
  /** section DOM id → 1-based page number within this PDF */
  sectionStartPages: Record<string, number>
}> {
  const treatFirstPageAsCover = options.treatFirstPageAsCover ?? true
  const parser = new PDFParse({ data: pdfBytes })
  try {
    const result = await parser.getText()
    const pages = result.pages ?? []
    const totalPages = pages.length
    const sectionStartPages: Record<string, number> = {}
    const firstEyebrowByPage: Array<string | null> = Array.from({ length: totalPages }, () => null)

    for (const page of pages) {
      const pageIndex = (page.num ?? 0) - 1
      if (pageIndex < 0 || pageIndex >= totalPages) continue
      const spaced = (page.text || '').replace(/\s+/g, ' ')
      MARKER_RE.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = MARKER_RE.exec(spaced)) != null) {
        const eyebrow = match[1].trim()
        const sectionId = match[2].trim()
        if (!sectionStartPages[sectionId]) {
          sectionStartPages[sectionId] = pageIndex + 1
        }
        if (!firstEyebrowByPage[pageIndex]) {
          firstEyebrowByPage[pageIndex] = eyebrow
        }
      }
    }

    const eyebrowsByPage: string[] = []
    let current = ''
    for (let i = 0; i < totalPages; i += 1) {
      if (treatFirstPageAsCover && i === 0) {
        eyebrowsByPage.push('')
        continue
      }
      if (firstEyebrowByPage[i]) {
        current = firstEyebrowByPage[i] as string
      }
      eyebrowsByPage.push(current)
    }

    return { totalPages, eyebrowsByPage, sectionStartPages }
  } finally {
    await parser.destroy?.()
  }
}

export interface StampReportChromeOptions {
  /** 0-based index to start stamping (0 = all pages, 1 = skip cover). Default 1. */
  startIndex?: number
  /** Added to displayed page numbers (e.g. 1 when a cover page will be prepended). */
  pageNumberOffset?: number
  /** Override total page count shown in footers. */
  totalPagesOverride?: number
}

function drawRoundedPill(
  page: PDFPage,
  x: number,
  y: number,
  width: number,
  height: number,
  color: ReturnType<typeof rgb>
) {
  page.drawCircle({
    x: x + height / 2,
    y: y + height / 2,
    size: height / 2,
    color
  })
  page.drawCircle({
    x: x + width - height / 2,
    y: y + height / 2,
    size: height / 2,
    color
  })
  page.drawRectangle({
    x: x + height / 2,
    y,
    width: Math.max(0, width - height),
    height,
    color
  })
}

/**
 * Draw repeating content-page chrome (navy header + footer) onto an already-rendered PDF.
 */
export async function stampReportChrome(
  pdfBytes: Buffer,
  options: ReportChromeOptions,
  eyebrowsByPage: string[],
  stampOptions: StampReportChromeOptions = {}
): Promise<Buffer> {
  const pdfDoc = await PDFDocument.load(pdfBytes)
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const pages = pdfDoc.getPages()
  const startIndex = stampOptions.startIndex ?? 1
  const pageNumberOffset = stampOptions.pageNumberOffset ?? 0
  const totalPages = stampOptions.totalPagesOverride ?? (pages.length + pageNumberOffset)

  const navy = hexToRgb(REPORT_COLORS.navy)
  const accent = hexToRgb(REPORT_COLORS.accent)
  const softGray = hexToRgb(REPORT_COLORS.softGray)
  const border = hexToRgb(REPORT_COLORS.border)
  const white = hexToRgb(REPORT_COLORS.white)
  const logoBg = hexToRgb(REPORT_COLORS.logoPill)

  const sideMargin = 40
  const headerHeight = 48

  for (let i = startIndex; i < pages.length; i += 1) {
    const page = pages[i]
    const { width, height } = page.getSize()
    const eyebrow = (eyebrowsByPage[i] || '').trim()
    const displayPage = i + 1 + pageNumberOffset

    // Solid navy header band
    page.drawRectangle({
      x: 0,
      y: height - headerHeight,
      width,
      height: headerHeight,
      color: rgb(navy.r, navy.g, navy.b)
    })

    // Section title in the pill (replaces SiteNook wordmark)
    const pillLabel = eyebrow || options.orgName || 'Report'
    const pillSize = 9
    const maxPillTextWidth = width - sideMargin * 2 - 180
    let visiblePill = pillLabel
    while (
      visiblePill.length > 4
      && helveticaBold.widthOfTextAtSize(visiblePill, pillSize) > maxPillTextWidth
    ) {
      visiblePill = `${visiblePill.slice(0, -2)}…`
    }
    const pillTextWidth = helveticaBold.widthOfTextAtSize(visiblePill, pillSize)
    const pillPadX = 12
    const pillH = 22
    const pillW = Math.min(width - sideMargin * 2 - 160, pillTextWidth + pillPadX * 2)
    const pillX = sideMargin
    const pillY = height - 35
    drawRoundedPill(page, pillX, pillY, pillW, pillH, rgb(logoBg.r, logoBg.g, logoBg.b))
    page.drawText(visiblePill, {
      x: pillX + pillPadX,
      y: pillY + 7,
      size: pillSize,
      font: helveticaBold,
      color: rgb(white.r, white.g, white.b)
    })

    // Org wordmark + timestamp (top-right, white on navy)
    const org = options.orgName || 'SiteNook'
    const orgSize = 10
    const orgWidth = helveticaBold.widthOfTextAtSize(org, orgSize)
    page.drawText(org, {
      x: width - sideMargin - orgWidth,
      y: height - 20,
      size: orgSize,
      font: helveticaBold,
      color: rgb(white.r, white.g, white.b)
    })
    const dateSize = 7.5
    const dateWidth = helvetica.widthOfTextAtSize(options.generatedAtLabel, dateSize)
    page.drawText(options.generatedAtLabel, {
      x: width - sideMargin - dateWidth,
      y: height - 32,
      size: dateSize,
      font: helvetica,
      color: rgb(
        (white.r + softGray.r) / 2,
        (white.g + softGray.g) / 2,
        (white.b + softGray.b) / 2
      )
    })

    // Footer
    const footerY = 22
    page.drawLine({
      start: { x: sideMargin, y: footerY + 12 },
      end: { x: width - sideMargin, y: footerY + 12 },
      thickness: 0.75,
      color: rgb(border.r, border.g, border.b)
    })

    const leftFooter = `SiteNook ${org} · ${options.scopeLabel} · ${options.generatedAtLabel}`
    page.drawText(leftFooter, {
      x: sideMargin,
      y: footerY,
      size: 7.5,
      font: helvetica,
      color: rgb(softGray.r, softGray.g, softGray.b)
    })

    const rightFooter = `Confidential scan report · Page ${displayPage} of ${totalPages}`
    const rightWidth = helvetica.widthOfTextAtSize(rightFooter, 7.5)
    page.drawText(rightFooter, {
      x: width - sideMargin - rightWidth,
      y: footerY,
      size: 7.5,
      font: helvetica,
      color: rgb(softGray.r, softGray.g, softGray.b)
    })

    // Subtle blue accent line under header
    page.drawRectangle({
      x: 0,
      y: height - headerHeight - 2,
      width,
      height: 2,
      color: rgb(accent.r, accent.g, accent.b)
    })
  }

  const stamped = await pdfDoc.save()
  return Buffer.from(stamped)
}

/**
 * Add GoTo link annotations for TOC entries so clicks jump to section pages
 * even when Chromium fragment links are unreliable.
 */
export async function addTocGoToLinks(
  pdfBytes: Buffer,
  sectionStartPages: Record<string, number>,
  options: { tocPageNumber?: number } = {}
): Promise<Buffer> {
  const tocPageNumber = options.tocPageNumber ?? sectionStartPages['section-table-of-contents']
  if (!tocPageNumber) return pdfBytes

  try {
    const pdfDoc = await PDFDocument.load(pdfBytes)
    const pages = pdfDoc.getPages()
    const tocPage = pages[tocPageNumber - 1]
    if (!tocPage) return pdfBytes

    const { width, height } = tocPage.getSize()
    const entries = Object.entries(sectionStartPages)
      .filter(([id]) => id !== 'section-table-of-contents')
      .sort((a, b) => a[1] - b[1])

    if (!entries.length) return pdfBytes

    const topY = height - 160
    const rowHeight = 52
    const left = 40
    const right = width - 40

    for (let i = 0; i < entries.length; i += 1) {
      const [, targetPage] = entries[i]
      const destPage = pages[targetPage - 1]
      if (!destPage) continue

      const yBottom = topY - (i + 1) * rowHeight
      const yTop = yBottom + rowHeight - 8
      if (yBottom < 40) break

      const annot = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [left, yBottom, right, yTop],
        Border: [0, 0, 0],
        C: [0.17, 0.42, 0.69],
        Dest: [destPage.ref, 'XYZ', null, destPage.getHeight(), null]
      })
      tocPage.node.addAnnot(pdfDoc.context.register(annot))
    }

    return Buffer.from(await pdfDoc.save())
  } catch {
    return pdfBytes
  }
}

export async function mergePdfBuffers(coverPdf: Buffer, contentPdf: Buffer): Promise<Buffer> {
  const merged = await PDFDocument.create()
  const coverDoc = await PDFDocument.load(coverPdf)
  const contentDoc = await PDFDocument.load(contentPdf)

  const coverPages = await merged.copyPages(coverDoc, coverDoc.getPageIndices())
  for (const page of coverPages) merged.addPage(page)

  const contentPages = await merged.copyPages(contentDoc, contentDoc.getPageIndices())
  for (const page of contentPages) merged.addPage(page)

  return Buffer.from(await merged.save())
}
