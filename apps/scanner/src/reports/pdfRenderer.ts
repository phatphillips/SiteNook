import type { ReportSectionData } from './types.js'
import type { ReportPdfOptions } from './preparePdfSections.js'
import { renderPdfReportWithPlaywright } from './htmlPdfRenderer.js'

export type { ReportPdfOptions } from './preparePdfSections.js'

export async function renderPdfReport(
  sections: ReportSectionData[],
  options: Omit<ReportPdfOptions, 'sections'>
): Promise<Buffer> {
  return await renderPdfReportWithPlaywright(sections, {
    ...options,
    sections
  })
}
