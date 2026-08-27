<script setup lang="ts">
import type { BlogCategory, BlogListItem } from '~/utils/blog'
import {
  featuredPosts,
  sortPostsByDateDesc
} from '~/utils/blog'
import { buildTeamTrialStartUrl, TEAM_TRIAL_CTA } from '~/utils/planPricing'
import { parseSelfServiceSignupFlag } from '~/utils/selfServiceSignup'

definePageMeta({
  middleware: 'marketing-public'
})

const config = useRuntimeConfig()
const selfServiceEnabled = computed(() => parseSelfServiceSignupFlag(config.public.selfServiceSignup))
const trialHref = computed(() =>
  selfServiceEnabled.value ? buildTeamTrialStartUrl() : '/signup'
)
const supportEmail = computed(() => {
  const email = config.public.supportEmail
  return typeof email === 'string' && email.trim() ? email.trim() : ''
})
const contactHref = computed(() =>
  supportEmail.value ? `mailto:${supportEmail.value}` : '/help'
)

const category = ref<BlogCategory | 'all'>('all')

const { data: rawPosts } = await useAsyncData('blog-posts', () =>
  $fetch<BlogListItem[]>('/api/blog/posts')
)

const posts = computed<BlogListItem[]>(() => rawPosts.value ?? [])

const featured = computed(() => featuredPosts(posts.value, 3))

const filtered = computed(() => {
  const sorted = sortPostsByDateDesc(posts.value)
  if (category.value === 'all') return sorted
  return sorted.filter(p => p.category === category.value)
})

useSeoMeta({
  title: 'Blog',
  description: 'Product updates, accessibility tips, and guides from SiteNook.'
})
</script>

<template>
  <div>
    <section class="border-b border-default/60">
      <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <p class="mb-3 text-sm font-medium text-primary">
          Blog
        </p>
        <h1 class="text-3xl font-semibold tracking-tight text-highlighted sm:text-4xl">
          News and guides from SiteNook
        </h1>
        <p class="mt-3 max-w-2xl text-base text-muted sm:text-lg">
          Product updates, research notes, and practical walkthroughs for teams who care about inclusive websites.
        </p>
      </div>
    </section>

    <section
      v-if="featured.length"
      class="border-b border-default/60 bg-elevated/20"
    >
      <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <BlogFeaturedGrid :posts="featured" />
      </div>
    </section>

    <section>
      <div class="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div class="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 class="text-xl font-semibold tracking-tight text-highlighted">
            All posts
          </h2>
          <BlogCategoryFilter v-model="category" />
        </div>
        <BlogPostList :posts="filtered" />
      </div>
    </section>

    <section class="border-t border-default/60 bg-elevated/25">
      <div class="mx-auto max-w-6xl px-4 py-14 text-center sm:px-6">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
          Ready to see how inclusive your site is?
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-muted">
          {{ TEAM_TRIAL_CTA.subcopy }}
        </p>
        <div class="mt-6 flex flex-wrap justify-center gap-3">
          <UButton :to="trialHref" size="lg" class="min-h-11">
            Start free trial
          </UButton>
          <UButton
            :href="contactHref"
            size="lg"
            variant="outline"
            color="neutral"
            class="min-h-11"
          >
            Contact
          </UButton>
        </div>
      </div>
    </section>
  </div>
</template>
