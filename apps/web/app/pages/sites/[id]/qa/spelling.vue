<script setup lang="ts">
import { buildSpellingCsv } from '~/utils/export/spellingExport'

definePageMeta({ middleware: 'auth' })
const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { spelling } = useQA(siteId, { summary: false, parts: ['spelling'] })

const tab = ref<'errors' | 'review'>('errors')
const displayed = computed(() =>
  spelling.value.filter(i =>
    tab.value === 'errors' ? i.confidence === 'error' : i.confidence === 'review'
  )
)

const page = ref(1)
const pageSize = ref(1)

watch(displayed, (rows) => {
  pageSize.value = Math.max(1, rows.length)
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
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Spelling" />
    </template>
    <template #body>
      <div class="space-y-4">
        <DataTableToolbar>
          <template #actions>
            <UButton
              icon="i-lucide-download"
              label="Export to CSV"
              color="neutral"
              variant="outline"
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

      <QaSpellingTable v-model:tab="tab" :items="spelling" />
      </div>
    </template>
  </AppDashboardPanel>
</template>
