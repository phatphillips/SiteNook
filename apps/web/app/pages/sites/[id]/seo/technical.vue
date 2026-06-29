<script setup lang="ts">
import type { SeoIssue } from '~/types/accessiq'
import { filterSeoIssues } from '~/utils/seoIssues'
import { SEO_SUBCATEGORY_LABELS } from '~/utils/seoRules'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId } = useSites()
const { issues, crawlAudit, openIssues } = useSEO(siteId)

const selectedIssue = ref<SeoIssue | null>(null)
const drawerOpen = ref(false)

const subcategoryFilter = computed(() => {
  const raw = route.query.subcategory
  return typeof raw === 'string' ? raw : 'all'
})

const subcategoryOptions = [
  { label: 'All', value: 'all' },
  { label: SEO_SUBCATEGORY_LABELS.crawlability, value: 'crawlability' },
  { label: SEO_SUBCATEGORY_LABELS.on_page, value: 'on_page' },
  { label: SEO_SUBCATEGORY_LABELS.structured_data, value: 'structured_data' }
]

const filtered = computed(() => {
  const base = filterSeoIssues(issues.value, { category: 'technical', statuses: ['open'] })
  if (subcategoryFilter.value === 'all') return base
  return base.filter(i => i.subcategory === subcategoryFilter.value)
})

function setSubcategory(value: string) {
  navigateTo({
    path: route.path,
    query: value === 'all' ? {} : { subcategory: value }
  })
}

function openIssue(issue: SeoIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}

onMounted(() => {
  activeSiteId.value = siteId.value
})
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Technical SEO" />
    </template>
    <template #body>
      <SitePageToolbar class="mb-2" />
      <SiteFilesPanel
        v-if="crawlAudit"
        :audit="crawlAudit"
        :issues="openIssues"
        class="mb-6"
        @view-issue="openIssue"
      />

      <div class="flex flex-wrap gap-2 mb-4">
        <UButton
          v-for="opt in subcategoryOptions"
          :key="opt.value"
          size="sm"
          :variant="subcategoryFilter === opt.value ? 'solid' : 'outline'"
          @click="setSubcategory(opt.value)"
        >
          {{ opt.label }}
        </UButton>
      </div>

      <SeoIssueTable :issues="filtered" @select="openIssue" />
      <SeoIssueDetailDrawer
        :issue="selectedIssue"
        :open="drawerOpen"
        :site-id="siteId"
        @update:open="drawerOpen = $event"
      />
    </template>
  </AppDashboardPanel>
</template>
