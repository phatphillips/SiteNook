<script setup lang="ts">
import { buildSpellingCsv } from '~/utils/export/spellingExport'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { spelling, loading } = useQA(siteId, { summary: false, parts: ['spelling'] })

const tab = ref<'errors' | 'review'>('errors')
const tableSearch = ref('')
const tableRef = useTemplateRef('tableRef')
const workspaceRef = useTemplateRef<HTMLElement>('workspaceRef')
const { height: workspaceHeight, update: updateWorkspaceHeight } = useViewportRemainderHeight(workspaceRef)

const displayed = computed(() =>
  spelling.value.filter(i =>
    tab.value === 'errors' ? i.confidence === 'error' : i.confidence === 'review'
  )
)

const page = ref(1)
const pageSize = ref(25)

watch(tab, () => {
  page.value = 1
})

watch(tableSearch, () => {
  page.value = 1
})

watch([loading, spelling], async () => {
  await nextTick()
  updateWorkspaceHeight()
})

const {
  exportModalOpen,
  exportConfig,
  exporting,
  progressMessage,
  runExport
} = useSimpleTableCsvExport({
  total: computed(() => displayed.value.length),
  page,
  pageSize,
  currentRows: displayed,
  feature: `spelling-${tab.value}`,
  scopeLabel: siteId,
  fetchAllRows: async () => displayed.value,
  buildCsv: rows => buildSpellingCsv(rows)
})
</script>

<template>
  <AppDashboardPanel fluid>
    <template #header>
      <DashboardPageNavbar title="Spelling" />
    </template>
    <template #body>
      <div class="space-y-3">
        <DataTableToolbar>
          <template #leading>
            <div class="flex min-w-0 flex-nowrap items-center gap-1.5 sm:gap-2">
              <UTabs
                v-model="tab"
                :items="[
                  { label: 'Misspellings', value: 'errors' },
                  { label: 'Words to Review', value: 'review' }
                ]"
                :content="false"
                size="sm"
                class="w-auto"
              />
              <TableSearchInput
                v-model="tableSearch"
                placeholder="Search spelling…"
                aria-label="Search spelling issues"
              />
              <UDropdownMenu
                :items="tableRef?.columnMenuItems ?? []"
                :content="{ align: 'start' }"
              >
                <TableToolbarMenuButton
                  label="Columns"
                  icon="i-lucide-columns-3"
                  aria-label="Toggle column visibility"
                />
              </UDropdownMenu>
            </div>
          </template>
          <template #actions>
            <UButton
              icon="i-lucide-download"
              label="Export to CSV"
              color="neutral"
              variant="outline"
              size="sm"
              class="max-lg:aspect-square max-lg:!px-2"
              :ui="{ base: 'h-8', label: 'hidden lg:inline' }"
              @click="exportModalOpen = true"
            />
          </template>
        </DataTableToolbar>

        <TableExportModal
          v-model:open="exportModalOpen"
          :config="exportConfig"
          :exporting="exporting"
          :progress-message="progressMessage"
          @export="runExport"
        />

        <div
          ref="workspaceRef"
          class="min-h-0"
          :style="{ height: workspaceHeight }"
        >
          <QaSpellingTable
            ref="tableRef"
            v-model:tab="tab"
            v-model:search="tableSearch"
            fill
            :show-tabs="false"
            :items="spelling"
            :loading="loading"
            :page="page"
            :page-size="pageSize"
            @update:page="page = $event"
          />
        </div>
      </div>
    </template>
  </AppDashboardPanel>
</template>
