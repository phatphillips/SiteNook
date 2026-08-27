import { defineCollection, defineContentConfig, z } from '@nuxt/content'

export default defineContentConfig({
  collections: {
    blog: defineCollection({
      type: 'page',
      source: 'blog/*.md',
      schema: z.object({
        title: z.string(),
        description: z.string(),
        date: z.string(),
        category: z.enum(['product', 'research', 'company', 'guides']),
        authors: z.array(z.string()),
        image: z.string(),
        featured: z.boolean().default(false)
      })
    })
  }
})
