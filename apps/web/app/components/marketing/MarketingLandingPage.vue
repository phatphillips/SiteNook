<script setup lang="ts">
const features = [
  {
    icon: 'i-lucide-accessibility',
    title: 'Accessibility monitoring',
    description: 'Crawl your sites with axe-core, track WCAG issues, and measure scores over time.'
  },
  {
    icon: 'i-lucide-shield-check',
    title: 'Quality assurance',
    description: 'Broken links, spelling checks, and content inventory — alongside accessibility in one place.'
  },
  {
    icon: 'i-lucide-users',
    title: 'Built for teams',
    description: 'Org-wide visibility with admin and viewer roles. Invite colleagues when you are ready to scale.'
  }
]
</script>

<template>
  <div>
    <section class="border-b border-default/60">
      <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div class="max-w-3xl">
          <p class="mb-4 text-sm font-medium text-muted">
            Hosted cloud accessibility &amp; QA monitoring
          </p>
          <h1 class="text-4xl font-semibold tracking-tight text-highlighted sm:text-5xl">
            Know how accessible your sites are — and keep them that way.
          </h1>
          <p class="mt-6 text-lg leading-relaxed text-muted">
            AccessIQ crawls your websites, surfaces WCAG issues, and gives your team a clear dashboard to track progress — without the enterprise price tag.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <UButton to="/pricing" size="lg">
              View pricing
            </UButton>
            <UButton to="/sign-in" size="lg" variant="soft" color="neutral">
              Sign in
            </UButton>
          </div>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div class="grid gap-6 md:grid-cols-3">
        <UCard
          v-for="feature in features"
          :key="feature.title"
          :ui="{ root: 'ring ring-default border border-default bg-elevated/30' }"
        >
          <div class="flex size-11 items-center justify-center rounded-xl bg-elevated ring-1 ring-default">
            <UIcon :name="feature.icon" class="size-5 text-default" />
          </div>
          <h2 class="mt-4 text-lg font-semibold text-highlighted">
            {{ feature.title }}
          </h2>
          <p class="mt-2 text-sm leading-relaxed text-muted">
            {{ feature.description }}
          </p>
        </UCard>
      </div>
    </section>

    <section class="border-t border-default/60 bg-elevated/20">
      <div class="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6">
        <h2 class="text-2xl font-semibold tracking-tight text-highlighted">
          Ready to get started?
        </h2>
        <p class="mx-auto mt-3 max-w-xl text-muted">
          Choose a plan that fits your team — Starter, Team, or Business — or start free with one site.
        </p>
        <UButton to="/pricing" class="mt-6" size="lg">
          See plans
        </UButton>
      </div>
    </section>
  </div>
</template>
