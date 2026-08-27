export function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function csvCell(value: unknown): string {
  if (value == null) return ''
  return escapeCsv(String(value))
}

export function buildCsv(headers: string[], rows: string[][]): string {
  const headerLine = headers.map(h => escapeCsv(h)).join(',')
  const dataLines = rows.map(row => row.map(cell => escapeCsv(cell)).join(','))
  return [headerLine, ...dataLines].join('\n')
}

export function downloadCsv(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export function exportFilename(feature: string, scope: string): string {
  const date = new Date().toISOString().slice(0, 10)
  const safeScope = scope.replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-|-$/g, '') || 'export'
  return `${feature}-${safeScope}-${date}.csv`
}
