export interface PaginatedResponse<T> {
  items: T[]
  total: number
  perPage: number
}

export async function fetchAllPages<T>(
  fetchPage: (page: number) => Promise<PaginatedResponse<T>>,
  options?: {
    onProgress?: (current: number, totalPages: number) => void
    signal?: AbortSignal
  }
): Promise<T[]> {
  const first = await fetchPage(1)
  if (options?.signal?.aborted) return []

  const perPage = Math.max(1, first.perPage)
  const totalPages = Math.max(1, Math.ceil(first.total / perPage))
  const all: T[] = [...first.items]
  options?.onProgress?.(1, totalPages)

  for (let page = 2; page <= totalPages; page++) {
    if (options?.signal?.aborted) break
    const response = await fetchPage(page)
    all.push(...response.items)
    options?.onProgress?.(page, totalPages)
  }

  return all
}
