import { loadAllBlogPosts, loadBlogPost, markdownToHtml, toListItem } from '../../utils/blogFs'
import { relatedPosts } from '~/utils/blog'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Missing slug' })
  }

  const post = await loadBlogPost(slug)
  if (!post) {
    throw createError({ statusCode: 404, statusMessage: 'Post not found' })
  }

  const all = await loadAllBlogPosts()
  const related = relatedPosts(
    all.map(toListItem),
    { path: post.path, category: String(post.category) },
    3
  )

  return {
    ...toListItem(post),
    bodyHtml: markdownToHtml(post.bodyMarkdown),
    related
  }
})
