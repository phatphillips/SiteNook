<script setup lang="ts">
import { format } from 'date-fns'
import type { PdfDocument } from '~/types/sitenook'
import { displayPdfFilename } from '~/utils/displayPdfFilename'
import { remediationStatusLabel, structureStatusLabel } from '~/utils/pdfRemediationExport'
import PdfComplianceSummary from '~/components/accessibility/pdf/PdfComplianceSummary.vue'

const props = defineProps<{
  document: PdfDocument
  issueCount: number
  ignoring?: boolean
  siteName?: string
}>()

const emit = defineEmits<{
  'update:ignored': [ignored: boolean]
}>()

const ignored = computed({
  get: () => !!props.document.ignored,
  set: (value: boolean) => emit('update:ignored', value)
})

type Meta = {
  title?: string
  author?: string
  creationDate?: string
  modificationDate?: string
  pdfVersion?: string
  pageCount?: number
  pageDimensions?: Array<{ width: number, height: number, unit?: string }>
}

const meta = computed(() => (props.document.pdf_metadata ?? {}) as Meta)

function formatDate(value?: string | null): string {
  if (!value) return '—'
  try {
    return format(new Date(value), 'dd MMM yyyy')
  } catch {
    return value
  }
}

function formatPdfDate(value?: string): string {
  if (!value) return '—'
  if (/^\d{4}-\d{2}-\d{2}/.test(value) || value.includes('T')) return formatDate(value)
  const match = value.match(/D:(\d{4})(\d{2})(\d{2})/)
  if (match) return `${match[3]}/${match[2]}/${match[1]}`
  return value
}

const pageSizeLabel = computed(() => {
  const dim = meta.value.pageDimensions?.[0]
  if (!dim) return null
  return `${dim.width} × ${dim.height} ${dim.unit || 'pt'}`
})

const rows = computed(() => {
  const doc = props.document
  const items: Array<{ label: string, value: string }> = [
    { label: 'File name', value: displayPdfFilename(doc.filename) },
    { label: 'Title', value: doc.document_title || meta.value.title || '—' },
    { label: 'Source', value: doc.source === 'crawl' ? 'Site crawl' : 'Uploaded' },
    {
      label: 'Site',
      value: props.siteName || (doc.site ? doc.site : 'Organization library')
    },
    {
      label: 'Pages',
      value: meta.value.pageCount != null ? String(meta.value.pageCount) : '—'
    },
    { label: 'Author', value: meta.value.author || '—' },
    { label: 'PDF version', value: meta.value.pdfVersion ? `PDF ${meta.value.pdfVersion}` : '—' },
    { label: 'Page size', value: pageSizeLabel.value || '—' },
    { label: 'Created', value: formatPdfDate(meta.value.creationDate) },
    { label: 'Last scanned', value: formatDate(doc.validated_at || doc.updated) },
    { label: 'Structure', value: structureStatusLabel(doc.structure_status) },
    { label: 'Assisted fix', value: remediationStatusLabel(doc.remediation_status) }
  ]

  if (doc.url) {
    items.splice(3, 0, { label: 'URL', value: doc.url })
  }

  return items
})
</script>

<template>
  <section
    class="rounded-xl border border-default bg-elevated/20 px-4 py-4 sm:px-5"
    aria-labelledby="pdf-document-properties-heading"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h2
          id="pdf-document-properties-heading"
          class="text-sm font-semibold text-highlighted"
        >
          Accessibility overview
        </h2>
        <p class="mt-0.5 text-xs text-muted">
          Compliance at a glance, with document details for remediation.
        </p>
      </div>
      <div class="flex items-center gap-3">
        <div class="text-right">
          <p class="text-xs font-medium text-highlighted">
            Ignore in future scans
          </p>
          <p class="text-[11px] text-muted">
            Skip on the next site crawl
          </p>
        </div>
        <USwitch
          v-model="ignored"
          :disabled="ignoring"
          aria-label="Ignore in future scans"
        />
      </div>
    </div>

    <div class="mt-5 grid gap-6 lg:grid-cols-2">
      <div class="min-w-0">
        <h3 class="mb-3 text-sm font-semibold text-highlighted">
          Compliance
        </h3>
        <PdfComplianceSummary
          :document="document"
          :issue-count="issueCount"
        />
      </div>

      <div class="min-w-0">
        <h3 class="mb-3 text-sm font-semibold text-highlighted">
          Document properties
        </h3>
        <dl class="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div
            v-for="row in rows"
            :key="row.label"
            class="min-w-0"
          >
            <dt class="text-xs font-medium text-muted">
              {{ row.label }}
            </dt>
            <dd
              class="mt-0.5 truncate text-sm text-highlighted"
              :title="row.value"
            >
              <a
                v-if="row.label === 'URL' && document.url"
                :href="document.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary hover:underline"
              >
                {{ row.value }}
              </a>
              <template v-else>
                {{ row.value }}
              </template>
            </dd>
          </div>
        </dl>
      </div>
    </div>
  </section>
</template>
