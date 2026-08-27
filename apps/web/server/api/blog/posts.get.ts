import { loadAllBlogPosts, toListItem } from '../../utils/blogFs'

export default defineEventHandler(async () => {
  const posts = await loadAllBlogPosts()
  return posts.map(toListItem)
})
