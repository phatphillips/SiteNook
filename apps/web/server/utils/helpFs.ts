import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import {
  HELP_CATEGORIES,
  helpCategoryLabel,
  helpPathFromParts,
  isCommercialHelpCategory,
  isHelpCategoryId,
  type HelpArticleSummary,
  type HelpCatalogCategory,
  type HelpCategoryId
} from '~/utils/help'
import { markdownToHtml, parseBlogFrontmatter } from '~/utils/blogMarkdown'
import { isCommercialEnabled } from './commercial'

export interface HelpArticleRecord extends HelpArticleSummary {
  bodyMarkdown: string
  bodyHtml: string
}

const HELP_DIR = join(process.cwd(), 'content', 'help')

function toArticle(category: HelpCategoryId, slug: string, raw: string): HelpArticleRecord | null {
  const { data, body } = parseBlogFrontmatter(raw)
  const title = typeof data.title === 'string' ? data.title : null
  const description = typeof data.description === 'string' ? data.description : ''
  const order = typeof data.order === 'string'
    ? Number(data.order) || 100
    : typeof data.order === 'number'
      ? data.order
      : 100

  if (!title) return null

  const path = helpPathFromParts(category, slug)
  return {
    title,
    description,
    category,
    categoryLabel: helpCategoryLabel(category),
    path,
    slug,
    order,
    bodyMarkdown: body,
    bodyHtml: markdownToHtml(body)
  }
}

async function listMarkdownInCategory(category: HelpCategoryId): Promise<HelpArticleRecord[]> {
  const dir = join(HELP_DIR, category)
  let files: string[]
  try {
    files = await readdir(dir)
  } catch {
    return []
  }

  const articles: HelpArticleRecord[] = []
  for (const file of files) {
    if (!file.endsWith('.md')) continue
    const slug = file.replace(/\.md$/i, '')
    const raw = await readFile(join(dir, file), 'utf8')
    const article = toArticle(category, slug, raw)
    if (article) articles.push(article)
  }

  return articles.sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}

export async function loadAllHelpArticles(): Promise<HelpArticleRecord[]> {
  const categories = isCommercialEnabled()
    ? HELP_CATEGORIES
    : HELP_CATEGORIES.filter(cat => !cat.commercialOnly)
  const batches = await Promise.all(
    categories.map(cat => listMarkdownInCategory(cat.id))
  )
  return batches.flat().sort((a, b) => a.order - b.order || a.title.localeCompare(b.title))
}

export async function loadHelpArticle(
  category: string,
  slug: string
): Promise<HelpArticleRecord | null> {
  if (!isHelpCategoryId(category) || !slug) return null
  if (!isCommercialEnabled() && isCommercialHelpCategory(category)) return null
  const safeSlug = slug.replace(/[^a-z0-9-_/]/gi, '')
  if (!safeSlug || safeSlug.includes('..')) return null
  try {
    const raw = await readFile(join(HELP_DIR, category, `${safeSlug}.md`), 'utf8')
    return toArticle(category, safeSlug, raw)
  } catch {
    return null
  }
}

export function toHelpSummary(article: HelpArticleRecord): HelpArticleSummary {
  return {
    title: article.title,
    description: article.description,
    category: article.category,
    categoryLabel: article.categoryLabel,
    path: article.path,
    slug: article.slug,
    order: article.order
  }
}

export async function buildHelpCatalog(): Promise<{
  categories: HelpCatalogCategory[]
}> {
  const all = await loadAllHelpArticles()
  const commercial = isCommercialEnabled()
  const categories = HELP_CATEGORIES
    .filter(meta => commercial || !meta.commercialOnly)
    .map((meta) => {
      const articles = all
        .filter(a => a.category === meta.id)
        .map(toHelpSummary)
      return {
        ...meta,
        articleCount: articles.length,
        articles
      }
    })
  return { categories }
}

export async function relatedHelpArticles(
  current: HelpArticleRecord,
  limit = 3
): Promise<HelpArticleSummary[]> {
  const all = await loadAllHelpArticles()
  return all
    .filter(a => a.path !== current.path && a.category === current.category)
    .slice(0, limit)
    .map(toHelpSummary)
}
