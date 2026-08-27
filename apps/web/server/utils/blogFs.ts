import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BlogCategory, BlogListItem } from '~/utils/blog'
import { markdownToHtml, parseBlogFrontmatter } from '~/utils/blogMarkdown'

export { markdownToHtml }

export interface BlogPostRecord extends BlogListItem {
  slug: string
  bodyMarkdown: string
}

const BLOG_DIR = join(process.cwd(), 'content', 'blog')

function toPost(slug: string, raw: string): BlogPostRecord | null {
  const { data, body } = parseBlogFrontmatter(raw)
  const title = typeof data.title === 'string' ? data.title : null
  const description = typeof data.description === 'string' ? data.description : null
  const date = typeof data.date === 'string' ? data.date : null
  const category = typeof data.category === 'string' ? data.category as BlogCategory : null
  const image = typeof data.image === 'string' ? data.image : '/blog/score-trends.svg'
  const authors = Array.isArray(data.authors)
    ? data.authors.filter((a): a is string => typeof a === 'string')
    : ['SiteNook Team']
  const featured = data.featured === true

  if (!title || !description || !date || !category) return null

  return {
    slug,
    title,
    description,
    date,
    category,
    authors,
    image,
    featured,
    path: `/blog/${slug}`,
    bodyMarkdown: body,
    body: body
  }
}

export async function loadAllBlogPosts(): Promise<BlogPostRecord[]> {
  let files: string[]
  try {
    files = await readdir(BLOG_DIR)
  } catch {
    return []
  }

  const posts: BlogPostRecord[] = []
  for (const file of files) {
    if (!file.endsWith('.md')) continue
    const slug = file.replace(/\.md$/i, '')
    const raw = await readFile(join(BLOG_DIR, file), 'utf8')
    const post = toPost(slug, raw)
    if (post) posts.push(post)
  }

  return posts.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
}

export async function loadBlogPost(slug: string): Promise<BlogPostRecord | null> {
  const safe = slug.replace(/[^a-z0-9-_]/gi, '')
  if (!safe) return null
  try {
    const raw = await readFile(join(BLOG_DIR, `${safe}.md`), 'utf8')
    return toPost(safe, raw)
  } catch {
    return null
  }
}

export function toListItem(post: BlogPostRecord): BlogListItem {
  return {
    title: post.title,
    description: post.description,
    date: post.date,
    category: post.category,
    authors: post.authors,
    image: post.image,
    featured: post.featured,
    path: post.path,
    body: post.bodyMarkdown
  }
}
