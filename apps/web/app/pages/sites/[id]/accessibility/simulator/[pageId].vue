<script setup lang="ts">
import type { AccessibilityIssue, PageRecord } from '~/types/sitenook'
import { A11Y_ISSUE_LIST_FIELDS } from '~/utils/a11yQueryFields'
import { pbRelation } from '~/utils/pbFilter'
import type { SimulatorVisionId } from '~/utils/simulatorChecks'
import { impactRank } from '~/utils/simulatorPages'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const pageId = computed(() => route.params.pageId as string)
const { activeSiteId } = useSites()
const { pb, awaitAuthReady, syncAuth } = usePocketBase()

const page = ref<PageRecord | null>(null)
const issues = ref<AccessibilityIssue[]>([])
const loading = ref(true)
const issuesLoading = ref(true)
const error = ref<string | null>(null)

provide('featurePageBannerLoading', loading)

const visionId = ref<SimulatorVisionId>('none')
const tabOrder = ref(false)
const selectedIssue = ref<AccessibilityIssue | null>(null)
const drawerOpen = ref(false)

const listPath = computed(() => `/sites/${siteId.value}/accessibility/simulator`)
const pageTitle = computed(() => page.value?.title || page.value?.url || 'Page simulator')

async function load() {
  loading.value = true
  issuesLoading.value = true
  error.value = null
  try {
    await awaitAuthReady()
    syncAuth()
    if (!pb) throw new Error('PocketBase client is not ready')

    const record = await pb.collection('pages').getOne(pageId.value, {
      fields: 'id,url,title,site,scan,html_size_bytes,preview_image'
    }) as unknown as PageRecord
    page.value = record

    const pageIssues = await pb.collection('accessibility_issues').getFullList({
      filter: `${pbRelation('page', pageId.value)} && status = "open"`,
      fields: A11Y_ISSUE_LIST_FIELDS
    }) as unknown as AccessibilityIssue[]

    issues.value = pageIssues
      .slice()
      .sort((a, b) => impactRank(b.impact) - impactRank(a.impact))
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
    page.value = null
    issues.value = []
  } finally {
    loading.value = false
    issuesLoading.value = false
  }
}

watch(siteId, (id) => {
  activeSiteId.value = id
})

watch(pageId, () => {
  void load()
})

onMounted(() => {
  activeSiteId.value = siteId.value
  void load()
})

function onSelectIssue(issue: AccessibilityIssue) {
  selectedIssue.value = issue
  drawerOpen.value = true
}
</script>

<template>
  <AppDashboardPanel full-width>
    <template #header>
      <DashboardPageNavbar>
        <template #title>
          <div class="flex items-center gap-2 min-w-0">
            <NuxtLink
              :to="listPath"
              class="text-muted hover:text-default shrink-0"
            >
              Simulator
            </NuxtLink>
            <span class="text-muted shrink-0">/</span>
            <span class="truncate font-semibold">{{ pageTitle }}</span>
          </div>
        </template>
        <template #right>
          <UButton
            v-if="page?.url"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-external-link"
            label="Open live page"
            :to="page.url"
            target="_blank"
            external
          />
        </template>
      </DashboardPageNavbar>
    </template>

    <template #body>
      <div class="space-y-4">
        <UAlert
          v-if="error"
          color="error"
          variant="subtle"
          :title="error"
          icon="i-lucide-alert-circle"
        />

        <AccessibilitySimulatorShell
          v-model:vision-id="visionId"
          v-model:tab-order="tabOrder"
          :site-id="siteId"
          :page-id="pageId"
          :page-url="page?.url"
          :preview-loading="loading"
          :issues="issues"
          :issues-loading="issuesLoading"
          :selected-issue-id="selectedIssue?.id"
          @select-issue="onSelectIssue"
        />

        <AccessibilityIssueDetailDrawer
          :issue="selectedIssue"
          :open="drawerOpen"
          :site-id="siteId"
          read-only
          @update:open="drawerOpen = $event"
        />
      </div>
    </template>
  </AppDashboardPanel>
</template>
