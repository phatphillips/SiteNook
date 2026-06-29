<script setup lang="ts">
import type { SeoIssue } from '~/types/accessiq'
import { filterSeoIssues } from '~/utils/seoIssues'

definePageMeta({ middleware: ['auth', 'plan-feature'], planFeature: 'seoModule' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId } = useSites()
const { issues } = useSEO(siteId)

const selectedIssue = ref<SeoIssue | null>(null)
const drawerOpen = ref(false)

const filtered = computed(() =>
  filterSeoIssues(issues.value, { category: 'content', statuses: ['open'] })
)

onMounted(() => {
  activeSiteId.value = siteId.value
})

function openIssue(issue: SeoIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Content SEO" />
    </template>
    <template #body>
      <SitePageToolbar class="mb-2" />
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
