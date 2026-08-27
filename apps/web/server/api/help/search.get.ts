import { createError, getQuery } from 'h3'
import { searchHelpArticles } from '../../utils/helpTypesense'
import { TypesenseUnavailableError } from '../../utils/typesenseConfig'

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const q = String(query.q || '').trim()

  if (!q) {
    return { hits: [], found: 0, unavailable: false }
  }

  try {
    const result = await searchHelpArticles(q)
    return { ...result, unavailable: false }
  } catch (error) {
    if (error instanceof TypesenseUnavailableError) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Search temporarily unavailable',
        data: { unavailable: true }
      })
    }
    const message = error instanceof Error ? error.message : 'Search failed'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
