<script setup lang="ts">
import SiteNookLogo from '~/components/shared/SiteNookLogo.vue'

const props = withDefaults(defineProps<{
  /** Slightly tailored copy for overview context */
  context?: 'home' | 'accessibility' | 'qa' | 'seo'
}>(), {
  context: 'home'
})

const { openWizard } = useAddSiteWizard()

const headline = computed(() => {
  switch (props.context) {
    case 'accessibility':
      return 'Add a site to see accessibility scores'
    case 'qa':
      return 'Add a site to start quality checks'
    case 'seo':
      return 'Add a site to track SEO health'
    default:
      return 'Add your first site to get started'
  }
})
</script>

<template>
  <div
    class="dashboard-empty-sites flex min-h-[22rem] w-full items-center justify-center rounded-xl border border-dashed border-default bg-elevated/20 px-6 py-12 sm:min-h-[26rem] sm:px-10"
    role="status"
  >
    <div class="flex max-w-md flex-col items-center text-center">
      <SiteNookLogo
        size="lg"
        class="dashboard-empty-sites__logo pointer-events-none mb-6"
      />
      <h2 class="text-lg font-semibold text-highlighted sm:text-xl">
        {{ headline }}
      </h2>
      <p class="mt-2 text-sm leading-relaxed text-muted">
        SiteNook needs a site URL to crawl. Add one, run a scan, and your scores, issues, and trends will show up here.
      </p>
      <div class="mt-6 flex flex-wrap items-center justify-center gap-2">
        <UButton
          color="primary"
          icon="i-lucide-plus"
          @click="openWizard()"
        >
          Add site
        </UButton>
        <UButton
          to="/sites"
          variant="ghost"
          color="neutral"
        >
          Go to Sites
        </UButton>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dashboard-empty-sites__logo {
  opacity: 0.35;
}
</style>
