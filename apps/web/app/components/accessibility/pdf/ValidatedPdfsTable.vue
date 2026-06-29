<script setup lang="ts">

import { h, resolveComponent } from 'vue'

import { format } from 'date-fns'

import { getPaginationRowModel, getSortedRowModel } from '@tanstack/vue-table'

import type { TableColumn } from '@nuxt/ui'

import type { Column, SortingState } from '@tanstack/vue-table'

import type { PdfDocument } from '~/types/accessiq'



const props = withDefaults(defineProps<{

  documents: PdfDocument[]

  siteId: string

  mode?: 'validate' | 'audit'

  title?: string

  siteNames?: Record<string, string>

  showSiteColumn?: boolean

  footerSummary?: string

  loading?: boolean

}>(), {

  mode: 'validate',

  title: undefined,

  siteNames: () => ({}),

  showSiteColumn: false,

  footerSummary: undefined,

  loading: false

})



const emit = defineEmits<{

  delete: [id: string]

  validate: [id: string]

  copyShare: [token: string]

  open: [doc: PdfDocument]

  export: []

}>()



const globalFilter = defineModel<string>('search', { default: '' })



const UButton = resolveComponent('UButton')

const UCheckbox = resolveComponent('UCheckbox')

const table = useTemplateRef<{ tableApi?: {

  getFilteredRowModel: () => { rows: unknown[] }

} }>('table')



const pagination = ref({ pageIndex: 0, pageSize: 20 })

const sorting = ref<SortingState>([{ id: 'uploaded_on', desc: true }])

const rowSelection = ref<Record<string, boolean>>({})



const sectionTitle = computed(() => {

  if (props.title) return props.title

  return props.mode === 'audit' ? 'PDFs found on this site' : 'Validated PDFs'

})



function sortableHeader(column: Column<PdfDocument, unknown>, label: string) {

  const isSorted = column.getIsSorted()

  return h(UButton, {

    color: 'neutral',

    variant: 'ghost',

    label,

    icon: isSorted

      ? (isSorted === 'asc' ? 'i-lucide-arrow-up-narrow-wide' : 'i-lucide-arrow-down-wide-narrow')

      : 'i-lucide-arrow-up-down',

    class: '-mx-2.5',

    onClick: () => column.toggleSorting(column.getIsSorted() === 'asc')

  })

}



function formatUploadedOn(doc: PdfDocument): string {

  const ts = doc.validated_at || doc.created

  if (!ts) return '—'

  try {

    return format(new Date(ts), 'dd/MM/yyyy, hh:mm a')

  } catch {

    return ts

  }

}



function reportLinkLabel(doc: PdfDocument): string {

  return doc.filename || doc.document_title || 'View report'

}



const columns = computed<TableColumn<PdfDocument>[]>(() => {

  const cols: TableColumn<PdfDocument>[] = [

    {

      id: 'select',

      header: ({ table: tableApi }) => h(UCheckbox, {

        modelValue: tableApi.getIsAllPageRowsSelected()

          ? true

          : tableApi.getIsSomePageRowsSelected()

            ? 'indeterminate'

            : false,

        'onUpdate:modelValue': (value: boolean | 'indeterminate') => {

          tableApi.toggleAllPageRowsSelected(value === true)

        },

        'aria-label': 'Select all'

      }),

      cell: ({ row }) => h(UCheckbox, {

        modelValue: row.getIsSelected(),

        'onUpdate:modelValue': (value: boolean | 'indeterminate') => row.toggleSelected(value === true),

        'aria-label': 'Select row'

      })

    }

  ]



  if (props.mode === 'audit') {

    cols.push({

      id: 'url',

      accessorFn: row => row.url || row.filename || '',

      header: ({ column }) => sortableHeader(column, 'PDF URL'),

      meta: { class: { th: 'w-[36%]', td: 'max-w-0' } },

      cell: ({ row }) => {

        const url = row.original.url

        return h('div', { class: 'min-w-0 overflow-hidden space-y-0.5' }, [

          url

            ? h('a', {

              href: url,

              target: '_blank',

              rel: 'noopener noreferrer',

              title: url,

              class: 'text-sm text-primary underline underline-offset-2 hover:text-primary/80 block truncate'

            }, url)

            : h('span', { class: 'text-sm text-muted' }, '—'),

          h('button', {

            type: 'button',

            title: reportLinkLabel(row.original),

            class: 'text-xs text-muted hover:text-primary hover:underline block truncate text-left',

            onClick: () => emit('open', row.original)

          }, reportLinkLabel(row.original))

        ])

      }

    })

  } else {

    cols.push({

      id: 'title',

      accessorFn: row => `${row.document_title || ''} ${row.filename || ''}`,

      header: ({ column }) => sortableHeader(column, 'PDF title'),

      meta: { class: { th: 'w-[28%]', td: 'max-w-0' } },

      cell: ({ row }) => h('div', { class: 'min-w-0 overflow-hidden space-y-0.5' }, [

        h('button', {

          type: 'button',

          class: 'text-sm text-primary underline underline-offset-2 hover:text-primary/80 block truncate text-left',

          onClick: () => emit('open', row.original)

        }, row.original.document_title || 'Unknown'),

        h('span', { class: 'text-xs text-muted block truncate' }, row.original.filename || '')

      ])

    })

  }



  if (props.showSiteColumn) {

    cols.push({

      id: 'site',

      accessorFn: row => props.siteNames[row.site] || row.site,

      header: 'Site',

      meta: { class: { th: 'w-32', td: 'truncate' } },

      cell: ({ row }) => h('span', {

        class: 'text-sm text-muted truncate block',

        title: props.siteNames[row.original.site] || row.original.site

      }, props.siteNames[row.original.site] || '—')

    })

  }



  cols.push(

    {

      id: 'uploaded_on',

      accessorFn: row => row.validated_at || row.created || '',

      header: ({ column }) => sortableHeader(column, props.mode === 'audit' ? 'Discovered on' : 'Uploaded on'),

      meta: { class: { th: 'w-40 whitespace-nowrap', td: 'whitespace-nowrap' } },

      cell: ({ row }) => h('span', { class: 'text-sm text-muted' }, formatUploadedOn(row.original))

    },

    {

      id: 'machine_readable',

      header: 'Machine-readable',

      meta: { class: { th: 'w-28 text-center', td: 'text-center' } },

      cell: ({ row }) => h(resolveComponent('AccessibilityPdfCheckIcon'), {

        value: row.original.machine_readable,

        status: row.original.status

      })

    },

    {

      id: 'has_pdf_tags',

      header: 'PDF tags',

      meta: { class: { th: 'w-24 text-center', td: 'text-center' } },

      cell: ({ row }) => h(resolveComponent('AccessibilityPdfCheckIcon'), {

        value: row.original.has_pdf_tags,

        status: row.original.status

      })

    },

    {

      id: 'issue_count',

      accessorKey: 'issue_count',

      header: ({ column }) => sortableHeader(column, 'Issues'),

      meta: { class: { th: 'w-20 text-right tabular-nums', td: 'text-right tabular-nums' } },

      cell: ({ row }) => h('span', { class: 'text-sm' }, String(row.original.issue_count ?? (row.original.status === 'complete' ? 0 : '—')))

    },

    {

      id: 'status',

      header: 'Status',

      cell: ({ row }) => h(resolveComponent('AccessibilityPdfStatusBadge'), {

        status: row.original.status,

        issueCount: row.original.issue_count

      })

    }

  )



  if (props.mode === 'audit') {

    cols.push({

      id: 'actions',

      header: '',

      cell: ({ row }) => {

        const needsValidation = row.original.status !== 'complete' && row.original.status !== 'processing'

        return h(UButton, {

          size: 'xs',

          color: 'neutral',

          variant: 'outline',

          label: needsValidation ? 'Validate' : 'Re-validate',

          disabled: row.original.status === 'processing' || row.original.status === 'pending',

          onClick: () => emit('validate', row.original.id)

        })

      }

    })

  } else {

    cols.push(

      {

        id: 'share',

        header: 'Share link',

        cell: ({ row }) => row.original.share_token

          ? h(UButton, {

            size: 'xs',

            color: 'neutral',

            variant: 'outline',

            icon: 'i-lucide-link',

            label: 'Copy',

            onClick: () => emit('copyShare', row.original.share_token!)

          })

          : h('span', { class: 'text-muted text-sm' }, '—')

      },

      {

        id: 'delete',

        header: 'Delete',

        cell: ({ row }) => h(UButton, {

          size: 'xs',

          color: 'neutral',

          variant: 'ghost',

          icon: 'i-lucide-trash-2',

          'aria-label': 'Delete PDF',

          onClick: () => emit('delete', row.original.id)

        })

      }

    )

  }



  return cols

})



const filteredCount = computed(() => table.value?.tableApi?.getFilteredRowModel().rows.length ?? props.documents.length)

</script>



<template>

  <div class="rounded-xl border border-default bg-elevated">

    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-default px-4 py-3">

      <h2 class="text-base font-semibold text-highlighted">

        {{ sectionTitle }}

      </h2>

      <div class="flex flex-wrap items-center gap-2">

        <TableSearchInput v-model="globalFilter" />

        <UButton

          color="neutral"

          variant="outline"

          icon="i-lucide-download"

          label="Export to CSV"

          @click="$emit('export')"

        />

      </div>

    </div>



    <div

      v-if="!documents.length && !loading"

      class="px-6 py-16 text-center"

    >

      <UIcon

        name="i-lucide-file-text"

        class="mx-auto mb-4 size-12 text-primary/60"

      />

      <p class="text-base font-medium text-highlighted">

        {{ mode === 'audit' ? 'No PDFs discovered yet' : 'No PDFs validated' }}

      </p>

      <p class="mt-1 text-sm text-muted">

        {{ mode === 'audit'

          ? 'Run a site crawl with inventory enabled to discover PDFs on your site.'

          : 'Get started checking PDFs by uploading them in the Upload PDFs widget.' }}

      </p>

    </div>



    <div

      v-else

      class="overflow-x-auto"

    >

      <UTable

        ref="table"

        v-model:global-filter="globalFilter"

        v-model:pagination="pagination"

        v-model:sorting="sorting"

        v-model:row-selection="rowSelection"

        class="min-w-[960px] table-fixed w-full"

        :data="documents"

        :columns="columns"

        :loading="loading"

        :pagination-options="{ getPaginationRowModel: getPaginationRowModel() }"

        :sorting-options="{ getSortedRowModel: getSortedRowModel() }"

      />

    </div>



    <div

      v-if="documents.length"

      class="flex items-center justify-between border-t border-default px-4 py-3 text-sm text-muted"

    >

      <span>{{ footerSummary || `${filteredCount} item(s)` }}</span>

      <span>Show 20 items per page</span>

    </div>

  </div>

</template>

