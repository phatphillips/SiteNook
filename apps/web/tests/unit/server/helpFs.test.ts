import { describe, expect, it } from 'vitest'
import { buildHelpCatalog, loadAllHelpArticles, loadHelpArticle } from '../../../server/utils/helpFs'

describe('helpFs catalog', () => {
  it('loads markdown articles for every category', async () => {
    const articles = await loadAllHelpArticles()
    expect(articles.length).toBeGreaterThanOrEqual(10)

    const catalog = await buildHelpCatalog()
    expect(catalog.categories).toHaveLength(5)
    for (const category of catalog.categories) {
      expect(category.articleCount).toBeGreaterThanOrEqual(2)
      expect(category.articles[0]?.path).toMatch(/^\/help\//)
    }
  })

  it('loads a single article with HTML body', async () => {
    const article = await loadHelpArticle('getting-started', 'first-scan')
    expect(article?.title).toBe('Your first scan')
    expect(article?.bodyHtml).toContain('<h2>')
    expect(article?.path).toBe('/help/getting-started/first-scan')
  })

  it('returns null for unknown paths', async () => {
    expect(await loadHelpArticle('getting-started', 'missing')).toBeNull()
    expect(await loadHelpArticle('nope', 'first-scan')).toBeNull()
  })
})
