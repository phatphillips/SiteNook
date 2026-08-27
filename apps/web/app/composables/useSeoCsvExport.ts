import type { Ref } from 'vue'
import type { SeoIssue } from '~/types/sitenook'
import type { OrgSeoIssueRow } from '~/composables/useOrgSEO'
import type { TableExportModalConfig, TableExportOptions } from '~/utils/tableExportScope'
import {
  mainPageCount,
  resolveMainRows,
  resolveSubRows
} from '~/utils/tableExportScope'
import { fetchAllPages } from '~/utils/fetchAllPages'
import { exportFilename } from '~/utils/csvExport'
import { buildSeoIssuesCsv } from '~/utils/export/seoExport'
import { seoAffectedPagesForRule } from '~/utils/seoIssues'
import type { SeoAffectedPageRow } from '~/utils/seoIssues'
import { orgApiFetch } from '~/utils/orgApiFetch'

const SUBTABLE_PAGE_SIZE = 25

export function useSeoCsvExport(options: {
  category: 'technical' | 'content'
  issues: Ref<OrgSeoIssueRow[]>
  total: Ref<number>
  page: Ref<number>
  perPage: Ref<number>
  showSiteColumn: Ref<boolean>
  resolvedSiteId: Ref<string | undefined>
  /** Site-scoped issues loaded client-side (site pages). */
  allIssues?: Ref<SeoIssue[]>
}) {
  const { executeExport, exporting, progressMessage } = useTableExport()
  const exportModalOpen = ref(false)

  const exportConfig = computed((): TableExportModalConfig => {
    const parents = options.issues.value
    const subTotal = parents.reduce((sum, issue) => {
      const pages = options.allIssues?.value
        ? seoAffectedPagesForRule(options.allIssues.value, issue.rule_id).length
        : 0
      return sum + pages
    }, 0)

    return {
      hasSubtable: true,
      subtableLabel: 'Affected pages',
      counts: {
        mainTotal: options.allIssues?.value
          ? options.allIssues.value.length
          : options.total.value,
        mainPageCount: options.allIssues?.value
          ? 1
          : mainPageCount(options.total.value, options.perPage.value),
        mainCurrentPageRows: parents.length,
        subtablePageSize: SUBTABLE_PAGE_SIZE,
        subtableTotalRows: subTotal,
        subtableCurrentPageRows: Math.min(SUBTABLE_PAGE_SIZE, subTotal)
      }
    }
  })

  async function fetchOrgIssues(pageNum: number) {
    const result = await orgApiFetch<{
      items: OrgSeoIssueRow[]
      total: number
      perPage: number
    }>('/api/org/seo/issues', {
      page: pageNum,
      perPage: options.perPage.value,
      siteId: options.resolvedSiteId.value,
      category: options.category
    })
    return { items: result.items, total: result.total, perPage: result.perPage }
  }

  async function runExport(exportOptions: TableExportOptions) {
    const scope = options.resolvedSiteId.value ?? 'org'
    await executeExport(
      exportOptions,
      exportFilename(`seo-${options.category}`, scope),
      async (opts, onProgress) => {
        const allIssues = options.allIssues?.value ?? []
        let mainRows: OrgSeoIssueRow[]

        if (options.allIssues?.value) {
          mainRows = resolveMainRows(
            options.issues.value as OrgSeoIssueRow[],
            opts,
            options.page.value,
            options.perPage.value
          )
        } else {
          onProgress('Fetching SEO issues…')
          const fetched = await fetchAllPages(fetchOrgIssues, {
            onProgress: (current, totalPages) => onProgress(`Fetching page ${current} of ${totalPages}…`)
          })
          mainRows = resolveMainRows(fetched, opts, options.page.value, options.perPage.value)
        }

        const includeSubtable = opts.dataMode === 'mainWithSubtable'
        const affectedByRule = new Map<string, SeoAffectedPageRow[]>()
        const issuePool = allIssues.length ? allIssues : mainRows

        if (includeSubtable) {
          for (const [index, issue] of mainRows.entries()) {
            onProgress(`Loading affected pages ${index + 1}/${mainRows.length}…`)
            const pages = seoAffectedPagesForRule(issuePool, issue.rule_id)
            affectedByRule.set(issue.rule_id, resolveSubRows(pages, opts, 0, SUBTABLE_PAGE_SIZE))
          }
        }

        onProgress('Building CSV…')
        return buildSeoIssuesCsv(issuePool, mainRows, affectedByRule, {
          includeSubtable,
          showSiteColumn: options.showSiteColumn.value
        })
      }
    )
  }

  return {
    exportModalOpen,
    exportConfig,
    exporting,
    progressMessage,
    runExport
  }
}
