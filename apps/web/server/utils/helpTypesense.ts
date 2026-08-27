import {
  getTypesenseClient
} from './typesenseClient'
import {
  isTypesenseEnabled,
  TypesenseUnavailableError
} from './typesenseConfig'
import { loadAllHelpArticles } from './helpFs'
import type { HelpSearchHit } from '~/utils/help'

export const HELP_COLLECTION = 'help_articles'

const HELP_SCHEMA = {
  name: HELP_COLLECTION,
  fields: [
    { name: 'title', type: 'string' as const },
    { name: 'description', type: 'string' as const },
    { name: 'category', type: 'string' as const, facet: true },
    { name: 'categoryLabel', type: 'string' as const },
    { name: 'body', type: 'string' as const },
    { name: 'path', type: 'string' as const },
    { name: 'order', type: 'int32' as const }
  ],
  default_sorting_field: 'order'
}

let collectionEnsured = false
let indexWarm = false

export function resetHelpTypesenseForTests(): void {
  collectionEnsured = false
  indexWarm = false
}

async function ensureHelpCollection(): Promise<boolean> {
  const ts = getTypesenseClient()
  if (!ts) return false
  if (collectionEnsured) return true

  try {
    await ts.collections(HELP_COLLECTION).retrieve()
  } catch {
    await ts.collections().create(HELP_SCHEMA)
  }
  collectionEnsured = true
  return true
}

export async function reindexHelpArticles(): Promise<{ indexed: number }> {
  if (!isTypesenseEnabled()) {
    throw new TypesenseUnavailableError()
  }
  const ts = getTypesenseClient()
  if (!ts) throw new TypesenseUnavailableError()

  await ensureHelpCollection()

  const articles = await loadAllHelpArticles()
  const documents = articles.map(article => ({
    id: article.path.replace(/^\//, '').replace(/\//g, '__'),
    title: article.title,
    description: article.description,
    category: article.category,
    categoryLabel: article.categoryLabel,
    body: article.bodyMarkdown.slice(0, 50_000),
    path: article.path,
    order: article.order
  }))

  // Replace collection contents for a clean index
  try {
    await ts.collections(HELP_COLLECTION).delete()
  } catch {
    // may not exist
  }
  collectionEnsured = false
  await ensureHelpCollection()

  if (documents.length) {
    await ts.collections(HELP_COLLECTION).documents().import(documents, { action: 'upsert' })
  }
  indexWarm = true
  return { indexed: documents.length }
}

/** Ensure collection exists and is populated at least once. */
export async function ensureHelpIndex(): Promise<void> {
  if (!isTypesenseEnabled()) return
  if (indexWarm) return
  try {
    const ts = getTypesenseClient()
    if (!ts) return
    await ensureHelpCollection()
    const coll = await ts.collections(HELP_COLLECTION).retrieve() as { num_documents?: number }
    if (!coll.num_documents) {
      await reindexHelpArticles()
    } else {
      indexWarm = true
    }
  } catch (error) {
    console.warn('[help-typesense] ensure index failed:', error)
  }
}

export async function searchHelpArticles(q: string, limit = 20): Promise<{
  hits: HelpSearchHit[]
  found: number
}> {
  const query = q.trim()
  if (!query) return { hits: [], found: 0 }

  if (!isTypesenseEnabled()) {
    throw new TypesenseUnavailableError()
  }

  await ensureHelpIndex()
  const ts = getTypesenseClient()
  if (!ts) throw new TypesenseUnavailableError()

  const result = await ts.collections(HELP_COLLECTION).documents().search({
    q: query,
    query_by: 'title,description,body',
    per_page: limit,
    prefix: true,
    highlight_full_fields: 'description,body',
    highlight_affix_num_tokens: 12
  })

  const hits: HelpSearchHit[] = (result.hits ?? []).map((hit) => {
    const doc = hit.document as {
      title?: string
      description?: string
      category?: string
      categoryLabel?: string
      path?: string
    }
    const highlights = (hit.highlights ?? []) as Array<{
      field?: string
      snippet?: string
      snippets?: string[]
    }>
    const preferred
      = highlights.find(h => h.field === 'description')
      || highlights.find(h => h.field === 'body')
      || highlights[0]
    const rawSnippet = preferred?.snippet
      || preferred?.snippets?.[0]
      || doc.description
      || ''

    return {
      title: doc.title ?? 'Untitled',
      description: doc.description ?? '',
      category: doc.category ?? '',
      categoryLabel: doc.categoryLabel ?? doc.category ?? '',
      path: doc.path ?? '/help',
      snippet: String(rawSnippet).replace(/<\/?mark>/g, '')
    }
  })

  return { hits, found: result.found ?? hits.length }
}
