import { createError } from 'h3'
import { reindexHelpArticles } from '../../utils/helpTypesense'
import { TypesenseUnavailableError } from '../../utils/typesenseConfig'

export default defineEventHandler(async () => {
  try {
    return await reindexHelpArticles()
  } catch (error) {
    if (error instanceof TypesenseUnavailableError) {
      throw createError({ statusCode: 503, statusMessage: error.message })
    }
    const message = error instanceof Error ? error.message : 'Reindex failed'
    throw createError({ statusCode: 500, statusMessage: message })
  }
})
