/** PocketBase / API timestamps may be missing or non-string. Safe descending sort key. */
export function timestampSortKey(value: unknown): number {
  if (value == null || value === '') return 0
  const ms = Date.parse(String(value))
  return Number.isFinite(ms) ? ms : 0
}

export function compareTimestampsDesc(a: unknown, b: unknown): number {
  return timestampSortKey(b) - timestampSortKey(a)
}
