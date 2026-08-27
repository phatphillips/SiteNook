import { chromium, type Browser } from 'playwright'

import { CHROMIUM_LAUNCH_ARGS } from '../crawler/browserProfile.js'
import type { ReportSectionData } from './types.js'
import type { ReportPdfOptions } from './preparePdfSections.js'
import { formatReportDate } from './preparePdfSections.js'
import { buildReportHtml } from './reportHtmlTemplate.js'
import {
  addTocGoToLinks,
  extractSectionPageMap,
  stampReportChrome
} from './reportChrome.js'

interface PdfMargin {
  top: string
  bottom: string
  left: string
  right: string
}

async function renderHtmlToPdfBuffer(
  browser: Browser,
  html: string,
  options: { extraCss?: string, margin: PdfMargin }
): Promise<Buffer> {
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    if (options.extraCss) {
      await page.addStyleTag({ content: options.extraCss })
    }
    await page.emulateMedia({ media: 'print' })
    await page.evaluate(async () => {
      if (document.fonts?.ready) {
        await document.fonts.ready
      }
    })

    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      margin: options.margin
    })

    return Buffer.from(pdf)
  } finally {
    await page.close()
  }
}

/**
 * Single-document HTML→PDF so Chromium fragment links (#section-*) stay valid.
 * Probe pass discovers TOC page numbers; final pass stamps navy chrome on content pages.
 */
export async function renderPdfReportWithPlaywright(
  sections: ReportSectionData[],
  options: ReportPdfOptions
): Promise<Buffer> {
  const orgName = options.orgName || options.summary?.orgName || 'SiteNook'
  const generatedAtLabel = formatReportDate(options.generatedAt)
  const margin: PdfMargin = {
    top: '0',
    bottom: '0',
    left: '0',
    right: '0'
  }

  const browser = await chromium.launch({
    headless: true,
    args: CHROMIUM_LAUNCH_ARGS
  })

  try {
    const probeHtml = buildReportHtml(sections, options)
    const probePdf = await renderHtmlToPdfBuffer(browser, probeHtml, { margin })
    const probeMap = await extractSectionPageMap(probePdf, { treatFirstPageAsCover: true })

    const finalHtml = buildReportHtml(sections, {
      ...options,
      sectionPageNumbers: probeMap.sectionStartPages
    })

    const finalPdf = await renderHtmlToPdfBuffer(browser, finalHtml, { margin })
    const finalMap = await extractSectionPageMap(finalPdf, { treatFirstPageAsCover: true })

    const stamped = await stampReportChrome(
      finalPdf,
      {
        orgName,
        scopeLabel: options.scopeLabel,
        generatedAtLabel
      },
      finalMap.eyebrowsByPage,
      {
        startIndex: 1,
        pageNumberOffset: 0,
        totalPagesOverride: finalMap.totalPages
      }
    )

    return await addTocGoToLinks(stamped, finalMap.sectionStartPages)
  } finally {
    await browser.close()
  }
}
