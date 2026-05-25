<script setup lang="ts">
import type { AccessibilityIssue } from '~/types/accessiq'
import { formatDistanceToNow } from 'date-fns'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { activeSiteId } = useSites()

const {
  latestScan,
  issues,
  scans,
  loading,
  wcagLevel,
  filters,
  levelCounts,
  filteredIssues,
  compositeScore,
  dismissIssue,
  markFixed
} = useAccessibility(siteId)

const pageTab = ref('issues')
const selectedIssue = ref<AccessibilityIssue | null>(null)
const drawerOpen = ref(false)

onMounted(() => {
  activeSiteId.value = siteId.value
  const level = route.query.level as string
  if (level && ['A', 'AA', 'AAA'].includes(level)) {
    wcagLevel.value = level as typeof wcagLevel.value
  }
})

function openFix(issue: AccessibilityIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}

async function handleDismiss(issue: AccessibilityIssue) {
  await dismissIssue(issue.id, 'user_dismissed')
}

async function handleDrawerFixed() {
  if (selectedIssue.value) {
    await markFixed(selectedIssue.value.id)
    drawerOpen.value = false
  }
}

async function handleDrawerDismiss(reason: string) {
  if (selectedIssue.value) {
    await dismissIssue(selectedIssue.value.id, reason)
    drawerOpen.value = false
  }
}

const pagesBreakdown = computed(() => {
  const map = new Map<string, { url: string, a: number, aa: number, aaa: number }>()
  for (const issue of issues.value) {
    const url = issue.expand?.page?.url || issue.page
    const row = map.get(url) || { url, a: 0, aa: 0, aaa: 0 }
    if (issue.wcag_level === 'A') row.a++
    if (issue.wcag_level === 'AA') row.aa++
    if (issue.wcag_level === 'AAA') row.aaa++
    map.set(url, row)
  }
  return [...map.values()]
})
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Accessibility">
        <template #leading>
          <UDashboardSidebarCollapse />
        </template>
        <template #right>
          <ScanTriggerButton :site-id="siteId" />
        </template>
      </UDashboardNavbar>
    </template>

    <template #body>
      <div v-if="loading" class="flex justify-center py-12">
        <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin" />
      </div>

      <template v-else>
        <div class="grid lg:grid-cols-4 gap-6 mb-6">
          <div class="lg:col-span-1 flex flex-col items-center">
            <AccessibilityScoreDonut :score="compositeScore" />
            <p v-if="latestScan?.completed_at" class="text-sm text-muted mt-2">
              Last scanned {{ formatDistanceToNow(new Date(latestScan.completed_at), { addSuffix: true }) }}
            </p>
          </div>
          <div class="lg:col-span-3 flex gap-4 items-center justify-center">
            <AccessibilityScoreDonut :score="latestScan?.score_a ?? 0" label="A" size="sm" />
            <AccessibilityScoreDonut :score="latestScan?.score_aa ?? 0" label="AA" size="sm" />
            <AccessibilityScoreDonut :score="latestScan?.score_aaa ?? 0" label="AAA" size="sm" />
          </div>
        </div>

        <AccessibilityTrendChart :scans="scans" class="mb-6" />

        <UTabs
          v-model="pageTab"
          :items="[
            { label: 'Issues', value: 'issues' },
            { label: 'By Page', value: 'pages' }
          ]"
          class="mb-4"
        />

        <template v-if="pageTab === 'issues'">
          <AccessibilityWcagLevelToggle v-model="wcagLevel" :counts="levelCounts" class="mb-4" />
          <AccessibilityIssueFilters
            v-model="filters"
            :total-count="issues.length"
            :filtered-count="filteredIssues.length"
            class="mb-4"
          />

          <div class="space-y-3 max-h-[600px] overflow-y-auto">
            <AccessibilityIssueCard
              v-for="issue in filteredIssues"
              :key="issue.id"
              :issue="issue"
              @fix="openFix(issue)"
              @dismiss="handleDismiss(issue)"
            />
            <p v-if="!filteredIssues.length" class="text-center text-muted py-8">No issues found</p>
          </div>
        </template>

        <UTable
          v-else
          :data="pagesBreakdown"
          :columns="[
            { accessorKey: 'url', header: 'Page URL' },
            { accessorKey: 'a', header: 'A' },
            { accessorKey: 'aa', header: 'AA' },
            { accessorKey: 'aaa', header: 'AAA' },
            { id: 'actions', header: '' }
          ]"
        >
          <template #url-cell="{ row }">
            <a :href="row.original.url" target="_blank" rel="noopener" class="text-primary hover:underline truncate block max-w-md">
              {{ row.original.url }}
            </a>
          </template>
          <template #actions-cell="{ row }">
            <ScanTriggerButton
              :site-id="siteId"
              :page-url="row.original.url"
              label="Scan page"
              size="xs"
              variant="outline"
            />
          </template>
        </UTable>
      </template>

      <AccessibilityIssueDetailDrawer
        :issue="selectedIssue"
        :open="drawerOpen"
        @update:open="drawerOpen = $event"
        @fixed="handleDrawerFixed"
        @dismiss="handleDrawerDismiss"
      />
    </template>
  </UDashboardPanel>
</template>
