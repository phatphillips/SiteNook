<script setup lang="ts">
import type {
  TableExportCounts,
  TableExportDataMode,
  TableExportModalConfig,
  TableExportOptions,
  TableExportRowScope
} from '~/utils/tableExportScope'
import { mainPageCount } from '~/utils/tableExportScope'

const props = defineProps<{
  config: TableExportModalConfig
  exporting?: boolean
  progressMessage?: string
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  export: [options: TableExportOptions]
}>()

const dataMode = ref<TableExportDataMode>('main')
const mainRowScope = ref<TableExportRowScope>('all')
const subRowScope = ref<TableExportRowScope>('all')

watch(open, (isOpen) => {
  if (isOpen) {
    dataMode.value = 'main'
    mainRowScope.value = 'all'
    subRowScope.value = 'all'
  }
})

const counts = computed(() => props.config.counts)

const mainAllLabel = computed(() => {
  const pages = counts.value.mainPageCount
  const rows = counts.value.mainTotal
  const pageWord = pages === 1 ? 'page' : 'pages'
  const rowWord = rows === 1 ? 'row' : 'rows'
  return `All pages (${pages} ${pageWord}, ${rows.toLocaleString()} ${rowWord})`
})

const mainCurrentLabel = computed(() => {
  const rows = counts.value.mainCurrentPageRows
  const rowWord = rows === 1 ? 'row' : 'rows'
  return `Current page only (${rows.toLocaleString()} ${rowWord})`
})

const subAllLabel = computed(() => {
  const total = counts.value.subtableTotalRows ?? 0
  const pageSize = counts.value.subtablePageSize ?? 10
  const pages = mainPageCount(total, pageSize)
  const pageWord = pages === 1 ? 'page' : 'pages'
  const rowWord = total === 1 ? 'row' : 'rows'
  return `All pages (${pages} ${pageWord}, ${total.toLocaleString()} ${rowWord})`
})

const subCurrentLabel = computed(() => {
  const rows = counts.value.subtableCurrentPageRows ?? 0
  const rowWord = rows === 1 ? 'row' : 'rows'
  return `Current page only (${rows.toLocaleString()} ${rowWord})`
})

const dataModeItems = computed(() => [
  { label: 'Main table only', value: 'main' },
  {
    label: `Main table plus "${props.config.subtableLabel ?? 'Pages'}" subtable`,
    value: 'mainWithSubtable'
  }
])

const mainScopeItems = computed(() => [
  { label: mainAllLabel.value, value: 'all' },
  { label: mainCurrentLabel.value, value: 'current' }
])

const subScopeItems = computed(() => [
  { label: subAllLabel.value, value: 'all' },
  { label: subCurrentLabel.value, value: 'current' }
])

const canDownload = computed(() => counts.value.mainTotal > 0 && !props.exporting)

function onDownload() {
  emit('export', {
    dataMode: props.config.hasSubtable ? dataMode.value : 'main',
    mainRowScope: mainRowScope.value,
    subRowScope: subRowScope.value
  })
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Export to CSV"
    description="Choose what to include in your download."
    :ui="{ content: 'sm:max-w-lg' }"
  >
    <template #body>
      <div class="space-y-6">
        <section v-if="config.hasSubtable" class="space-y-3">
          <h3 class="text-sm font-medium text-default">
            Data
          </h3>
          <URadioGroup
            v-model="dataMode"
            :items="dataModeItems"
            variant="card"
          />
        </section>

        <section class="space-y-3">
          <h3 class="text-sm font-medium text-default">
            Main table rows
          </h3>
          <URadioGroup
            v-model="mainRowScope"
            :items="mainScopeItems"
            variant="card"
          />
        </section>

        <section
          v-if="config.hasSubtable && dataMode === 'mainWithSubtable'"
          class="space-y-3"
        >
          <h3 class="text-sm font-medium text-default">
            {{ config.subtableLabel ?? 'Pages' }}
          </h3>
          <URadioGroup
            v-model="subRowScope"
            :items="subScopeItems"
            variant="card"
          />
        </section>

        <p v-if="exporting && progressMessage" class="text-sm text-muted">
          {{ progressMessage }}
        </p>
      </div>
    </template>

    <template #footer>
      <div class="flex w-full justify-end gap-2">
        <UButton
          label="Cancel"
          color="neutral"
          variant="outline"
          :disabled="exporting"
          @click="open = false"
        />
        <UButton
          icon="i-lucide-download"
          label="Download CSV"
          :loading="exporting"
          :disabled="!canDownload"
          @click="onDownload"
        />
      </div>
    </template>
  </UModal>
</template>
