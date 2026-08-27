export type TableExportDataMode = 'main' | 'mainWithSubtable'
export type TableExportRowScope = 'all' | 'current'

export interface TableExportCounts {
  mainTotal: number
  mainPageCount: number
  mainCurrentPageRows: number
  subtablePageSize?: number
  subtableCurrentPageRows?: number
  subtableTotalRows?: number
}

export interface TableExportModalConfig {
  hasSubtable: boolean
  subtableLabel?: string
  counts: TableExportCounts
}

export interface TableExportOptions {
  dataMode: TableExportDataMode
  mainRowScope: TableExportRowScope
  subRowScope: TableExportRowScope
}

export function mainPageCount(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 0
  return Math.ceil(total / pageSize)
}

export function sliceCurrentPage<T>(rows: T[], page: number, pageSize: number): T[] {
  const start = Math.max(0, (page - 1) * pageSize)
  return rows.slice(start, start + pageSize)
}

export function sliceSubtablePage<T>(rows: T[], pageIndex: number, pageSize: number): T[] {
  const start = Math.max(0, pageIndex * pageSize)
  return rows.slice(start, start + pageSize)
}

export function resolveMainRows<T>(
  allRows: T[],
  options: Pick<TableExportOptions, 'mainRowScope'>,
  page: number,
  pageSize: number
): T[] {
  if (options.mainRowScope === 'current') {
    return sliceCurrentPage(allRows, page, pageSize)
  }
  return allRows
}

export function resolveSubRows<T>(
  rows: T[],
  options: Pick<TableExportOptions, 'subRowScope'>,
  subPageIndex: number,
  subPageSize: number
): T[] {
  if (options.subRowScope === 'current') {
    return sliceSubtablePage(rows, subPageIndex, subPageSize)
  }
  return rows
}

export function isColumnVisible(
  columnVisibility: Record<string, boolean> | undefined,
  columnId: string
): boolean {
  if (!columnVisibility) return true
  if (columnId in columnVisibility) return columnVisibility[columnId] !== false
  return true
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>,
  onProgress?: (completed: number, total: number) => void
): Promise<R[]> {
  if (!items.length) return []
  const results: R[] = new Array(items.length)
  let nextIndex = 0
  let completed = 0

  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex++
      results[index] = await mapper(items[index]!, index)
      completed++
      onProgress?.(completed, items.length)
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker()
  )
  await Promise.all(workers)
  return results
}
