import Typesense from 'typesense'
import {
  isTypesenseEnabled,
  parseTypesenseUrl,
  SEARCH_COLLECTION
} from './typesenseConfig.js'

let client: Typesense.Client | null = null
let collectionEnsured = false

export function getTypesenseClient(): Typesense.Client | null {
  if (!isTypesenseEnabled()) return null
  if (!client) {
    const node = parseTypesenseUrl(process.env.TYPESENSE_URL!)
    client = new Typesense.Client({
      nodes: [node],
      apiKey: process.env.TYPESENSE_API_KEY!,
      connectionTimeoutSeconds: 10
    })
  }
  return client
}

const COLLECTION_SCHEMA = {
  name: SEARCH_COLLECTION,
  fields: [
    { name: 'orgId', type: 'string' as const, facet: true },
    { name: 'siteId', type: 'string' as const, facet: true },
    { name: 'siteName', type: 'string' as const },
    { name: 'url', type: 'string' as const, infix: true },
    { name: 'urlKey', type: 'string' as const },
    { name: 'type', type: 'string' as const, facet: true },
    { name: 'title', type: 'string' as const, infix: true },
    { name: 'body', type: 'string' as const, infix: true },
    { name: 'pdfAuthor', type: 'string' as const, optional: true, infix: true },
    { name: 'pdfSubject', type: 'string' as const, optional: true, infix: true },
    { name: 'pdfKeywords', type: 'string' as const, optional: true, infix: true },
    { name: 'pdfCreator', type: 'string' as const, optional: true, infix: true },
    { name: 'pdfProducer', type: 'string' as const, optional: true, infix: true },
    { name: 'lastScannedAt', type: 'int64' as const },
    { name: 'pageId', type: 'string' as const, optional: true },
    { name: 'pdfDocumentId', type: 'string' as const, optional: true }
  ],
  default_sorting_field: 'lastScannedAt'
}

/** Fields queried with infix search must have `infix: true` in the collection schema. */
const INFIX_QUERY_FIELDS = [
  'title',
  'body',
  'url',
  'pdfAuthor',
  'pdfSubject',
  'pdfKeywords',
  'pdfCreator',
  'pdfProducer'
] as const

async function collectionNeedsRecreate(ts: Typesense.Client): Promise<boolean> {
  try {
    const coll = await ts.collections(SEARCH_COLLECTION).retrieve() as {
      fields?: Array<{ name?: string, infix?: boolean }>
    }
    const byName = new Map(
      (coll.fields ?? []).map(field => [String(field.name ?? ''), field.infix === true])
    )
    return INFIX_QUERY_FIELDS.some(name => byName.get(name) !== true)
  } catch {
    return true
  }
}

export async function ensureSearchCollection(): Promise<void> {
  const ts = getTypesenseClient()
  if (!ts) return
  if (collectionEnsured) return

  const recreate = await collectionNeedsRecreate(ts)
  if (recreate) {
    try {
      await ts.collections(SEARCH_COLLECTION).delete()
    } catch {
      // Collection may not exist yet.
    }
    await ts.collections().create(COLLECTION_SCHEMA)
    console.warn('Search index collection (re)created — run reindex-search to repopulate.')
  }

  collectionEnsured = true
}

export function resetTypesenseClientForTests(): void {
  client = null
  collectionEnsured = false
}
