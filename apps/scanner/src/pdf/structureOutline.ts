export interface StructureOutlineItem {
  id: string | number
  type: string
  page?: number
  content?: string
  level?: number | string
  bbox?: number[]
}

export interface StructureOutline {
  elementCount: number
  types: Record<string, number>
  items: StructureOutlineItem[]
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

function collectElements(node: unknown, acc: unknown[] = []): unknown[] {
  if (!node || typeof node !== 'object') return acc
  const obj = node as Record<string, unknown>
  if (typeof obj.type === 'string' || typeof obj.type === 'number') {
    acc.push(obj)
  }
  for (const key of ['elements', 'children', 'items', 'content']) {
    const child = obj[key]
    if (Array.isArray(child)) {
      for (const item of child) collectElements(item, acc)
    } else if (child && typeof child === 'object') {
      collectElements(child, acc)
    }
  }
  return acc
}

export function buildStructureOutline(jsonText: string, limit = 200): StructureOutline {
  let parsed: unknown = {}
  try {
    parsed = jsonText ? JSON.parse(jsonText) : {}
  } catch {
    return { elementCount: 0, types: {}, items: [] }
  }

  const root = parsed as Record<string, unknown>
  const candidates = [
    ...asArray(root.elements),
    ...asArray(root.children),
    ...asArray(root.items),
    ...collectElements(parsed)
  ]

  const seen = new Set<unknown>()
  const unique: Record<string, unknown>[] = []
  for (const item of candidates) {
    if (!item || typeof item !== 'object' || seen.has(item)) continue
    seen.add(item)
    unique.push(item as Record<string, unknown>)
  }

  const types: Record<string, number> = {}
  const items: StructureOutlineItem[] = []
  for (const el of unique) {
    const type = String(el.type ?? el.Type ?? 'unknown').toLowerCase()
    types[type] = (types[type] ?? 0) + 1
    if (items.length >= limit) continue
    const bboxRaw = el.boundingBox ?? el['bounding box'] ?? el.bbox ?? el.BoundingBox
    const bbox = Array.isArray(bboxRaw) ? bboxRaw.map(Number).filter(n => Number.isFinite(n)) : undefined
    items.push({
      id: (el.id as string | number) ?? items.length,
      type,
      page: Number(el.pageNumber ?? el['page number'] ?? el.page ?? 0) || undefined,
      content: String(el.content ?? el.text ?? '').slice(0, 240) || undefined,
      level: (el.headingLevel ?? el['heading level'] ?? el.level) as number | string | undefined,
      bbox: bbox && bbox.length >= 4 ? bbox.slice(0, 4) : undefined
    })
  }

  return {
    elementCount: unique.length,
    types,
    items
  }
}

export function computeIssueDelta(beforeCount: number, afterCount: number): number {
  return beforeCount - afterCount
}

export function computeLiftPercent(beforeCount: number, afterCount: number): number | null {
  if (beforeCount <= 0) return afterCount === 0 ? 0 : null
  return Math.round(((beforeCount - afterCount) / beforeCount) * 1000) / 10
}
