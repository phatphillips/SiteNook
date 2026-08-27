<script setup lang="ts">
import type { TableColumn } from '@nuxt/ui'
import type { SpellingIssue } from '~/types/sitenook'
import {
  SPELLING_TABLE_SKELETON_COLUMNS,
  SPELLING_TABLE_WITH_SITE_SKELETON_COLUMNS
} from '~/utils/dataTableSkeletonColumns'
import { DATA_TABLE_UI } from '~/utils/dataTableUi'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'

const props = withDefaults(defineProps<{
  items: SpellingIssue[]
  showSiteColumn?: boolean
  serverPaginated?: boolean
  total?: number
  page?: number
  pageSize?: number
  loading?: boolean
  tab?: 'errors' | 'review'
}>(), {
  showSiteColumn: false,
  serverPaginated: false,
  total: 0,
  page: 1,
  pageSize: 20,
  loading: false,
  tab: 'errors'
})

const emit = defineEmits<{
  'update:page': [page: number]
  'update:tab': [tab: 'errors' | 'review']
}>()

const dictionary = ref<string[]>([])
const newWord = ref('')

const tabModel = computed({
  get: () => props.tab,
  set: value => emit('update:tab', value)
})

const displayed = computed(() =>
  props.serverPaginated
    ? props.items
    : props.items.filter(i =>
        props.tab === 'errors' ? i.confidence === 'error' : i.confidence === 'review'
      )
)

const skeletonLayout = computed(() =>
  props.showSiteColumn
    ? SPELLING_TABLE_WITH_SITE_SKELETON_COLUMNS
    : SPELLING_TABLE_SKELETON_COLUMNS
)

const columns = computed((): TableColumn<SpellingIssue>[] => [
  ...(props.showSiteColumn
    ? [{
        accessorKey: 'siteName',
        header: 'Site',
        cell: ({ row }: { row: { original: { siteName?: string } } }) => row.original.siteName || '—'
      }]
    : []),
  { accessorKey: 'word', header: 'Word' },
  { accessorKey: 'context', header: 'Context' },
  {
    id: 'page',
    header: 'Page URL',
    cell: ({ row }: { row: { original: SpellingIssue } }) => row.original.expand?.page?.url || ''
  }
])

const stableLoading = useStableLoading(toRef(() => props.loading))

const showInitialSkeleton = computed(
  () => stableLoading.value && !props.items.length
)

const showPagination = computed(
  () => props.serverPaginated && props.total > props.pageSize
)

const footerSummary = computed(() => {
  if (!showPagination.value) return ''
  const pageStart = props.total === 0 ? 0 : (props.page - 1) * props.pageSize + 1
  const pageEnd = Math.min(props.page * props.pageSize, props.total)
  return `Showing ${pageStart}-${pageEnd} of ${props.total.toLocaleString()}`
})

function addWord() {
  if (newWord.value.trim()) {
    dictionary.value.push(newWord.value.trim())
    newWord.value = ''
  }
}

const tablePanelRef = useTemplateRef<HTMLElement>('tablePanelRef')

function onPaginationChange(nextPage: number) {
  scrollDataTableIntoView(tablePanelRef.value)
  emit('update:page', nextPage)
}

watch(
  () => props.page,
  (nextPage, previousPage) => {
    if (!props.serverPaginated || nextPage === previousPage) return
    scrollDataTableIntoView(tablePanelRef.value)
  }
)
</script>

<template>
  <div class="grid lg:grid-cols-3 gap-6">
    <div class="lg:col-span-2 space-y-4">
      <div class="flex gap-2">
        <UButton
          :variant="tabModel === 'errors' ? 'solid' : 'outline'"
          @click="tabModel = 'errors'"
        >
          Misspellings
        </UButton>
        <UButton
          :variant="tabModel === 'review' ? 'solid' : 'outline'"
          @click="tabModel = 'review'"
        >
          Words to Review
        </UButton>
      </div>

      <div ref="tablePanelRef" class="table-surface">
        <DataTableSkeleton
          v-if="showInitialSkeleton"
          :rows="pageSize"
          :layout="skeletonLayout"
        />
        <UTable
          v-else
          :data="displayed"
          :columns="columns"
          :loading="stableLoading && !!items.length"
          :ui="DATA_TABLE_UI"
        >
          <template #loading>
            <DataTableSkeleton
              :rows="Math.min(pageSize, 5)"
              :layout="skeletonLayout"
              :show-header="false"
            />
          </template>
        </UTable>

        <div
          v-if="showPagination && !showInitialSkeleton"
          class="flex flex-wrap items-center justify-between gap-2 border-t border-default px-4 py-2"
        >
          <p class="text-xs text-muted">
            {{ footerSummary }}
          </p>
          <UPagination
            :page="page"
            :items-per-page="pageSize"
            :total="total"
            class="ms-auto"
            @update:page="onPaginationChange"
          />
        </div>
      </div>

      <p
        v-if="!displayed.length && !loading"
        class="text-sm text-muted py-4 text-center"
      >
        No spelling issues in this category yet.
      </p>
    </div>

    <UCard>
      <template #header>
        <h3 class="font-medium">Custom Dictionary</h3>
      </template>
      <div class="flex gap-2 mb-3">
        <UInput v-model="newWord" placeholder="Add word..." class="flex-1" />
        <UButton @click="addWord">Add</UButton>
      </div>
      <ul class="space-y-1">
        <li v-for="word in dictionary" :key="word" class="text-sm">{{ word }}</li>
      </ul>
      <p v-if="!dictionary.length" class="text-sm text-muted">No custom words yet</p>
    </UCard>
  </div>
</template>
