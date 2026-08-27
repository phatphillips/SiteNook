import JSZip from 'jszip'
import { sectionFilename, type ReportSectionData } from './types.js'

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(escapeCsv).join(',')
  const dataLines = rows.map(row => row.map(cell => escapeCsv(cell)).join(','))
  return [headerLine, ...dataLines].join('\n')
}

export async function renderCsvArchive(sections: ReportSectionData[]): Promise<Buffer> {
  const zip = new JSZip()
  for (const section of sections) {
    zip.file(sectionFilename(section.key), buildCsv(section.headers, section.rows))
  }
  return await zip.generateAsync({ type: 'nodebuffer' })
}
