/**
 * PocketBase filter string helpers.
 * Relation IDs: double quotes. Select / text values: single quotes.
 * @see https://pocketbase.io/docs/api-rules-and-filters/
 */
export function pbRelation(field: string, id: string): string {
  return `${field} = "${id}"`
}

export function pbSelect(field: string, value: string): string {
  return `${field} = '${value}'`
}

export function pbOr(clauses: string[]): string {
  return `(${clauses.join(' || ')})`
}

export function pbAnd(clauses: string[]): string {
  return clauses.filter(Boolean).join(' && ')
}

/** Case-insensitive contains filter (PocketBase `~`). */
export function pbContains(field: string, value: string): string {
  const escaped = value.replace(/\\/g, '\\\\').replace(/'/g, '\\\'')
  return `${field} ~ '${escaped}'`
}
