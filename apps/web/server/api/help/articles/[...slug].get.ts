import { createError, getRouterParam } from 'h3'
import {
  loadHelpArticle,
  relatedHelpArticles,
  toHelpSummary,
  buildHelpCatalog
} from '../../../utils/helpFs'
import { helpCategoryMeta, isHelpCategoryId, parseHelpSlugParam } from '~/utils/help'

export default defineEventHandler(async (event) => {
  const raw = getRouterParam(event, 'slug') || ''
  const parsed = parseHelpSlugParam(raw)
  if (!parsed) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  // Category landing: /help/{category}
  if (!parsed.slug && isHelpCategoryId(parsed.category)) {
    const meta = helpCategoryMeta(parsed.category)
    const catalog = await buildHelpCatalog()
    const category = catalog.categories.find(c => c.id === parsed.category)
    if (!meta || !category) {
      throw createError({ statusCode: 404, statusMessage: 'Category not found' })
    }
    return {
      type: 'category' as const,
      category: meta,
      articles: category.articles
    }
  }

  const article = await loadHelpArticle(parsed.category, parsed.slug)
  if (!article) {
    throw createError({ statusCode: 404, statusMessage: 'Article not found' })
  }

  const related = await relatedHelpArticles(article)
  return {
    type: 'article' as const,
    ...toHelpSummary(article),
    bodyHtml: article.bodyHtml,
    related
  }
})
