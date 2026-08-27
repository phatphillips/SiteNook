import type { Ref } from 'vue'
import type { A11yIssueActionEntry, A11yIssueActionType } from '~/utils/a11yIssueHistory'
import { getUserOrganizationId } from '~/utils/orgAccess'
import { pbAnd, pbContains, pbOr, pbRelation, pbSelect } from '~/utils/pbFilter'

export type A11yHistoryFilter = 'all' | A11yIssueActionType

export function useA11yIssueHistory(siteId?: Ref<string | undefined> | string) {
  const { pb, awaitAuthReady } = usePocketBase()
  const { sites } = useSites()

  const entries = ref<A11yIssueActionEntry[]>([])
  const loading = ref(false)
  const error = ref('')
  const page = ref(1)
  const perPage = ref(20)
  const totalItems = ref(0)
  const totalPages = ref(0)
  const filter = ref<A11yHistoryFilter>('all')
  const search = ref('')

  const resolvedSiteId = computed(() => {
    if (siteId == null) return undefined
    return typeof siteId === 'object' ? siteId.value : siteId
  })

  const isOrgScoped = computed(() => !resolvedSiteId.value)

  async function fetchHistory(options?: { silent?: boolean }) {
    if (!import.meta.client) return
    await awaitAuthReady()
    if (!pb?.authStore.token) {
      error.value = 'Your session has expired. Please sign in again.'
      return
    }

    if (!options?.silent) loading.value = true
    error.value = ''

    try {
      const parts: string[] = []
      if (resolvedSiteId.value) {
        parts.push(pbRelation('site', resolvedSiteId.value))
      } else {
        const record = pb.authStore.record
        const orgId = record ? getUserOrganizationId(record) : ''
        if (orgId) parts.push(pbRelation('organization', orgId))
      }

      if (filter.value !== 'all') {
        parts.push(pbSelect('action', filter.value))
      }

      const q = search.value.trim()
      if (q) {
        parts.push(pbOr([
          pbContains('rule_id', q),
          pbContains('description', q),
          pbContains('page_url', q),
          pbContains('page_title', q)
        ]))
      }

      const result = await pb.collection('accessibility_issue_actions').getList(page.value, perPage.value, {
        filter: pbAnd(parts) || undefined,
        sort: '-logged_at',
        expand: 'actor,site'
      })

      entries.value = result.items as unknown as A11yIssueActionEntry[]
      totalItems.value = result.totalItems
      totalPages.value = result.totalPages
      page.value = result.page
    } catch (e: unknown) {
      error.value = e && typeof e === 'object' && 'message' in e
        ? String((e as { message: string }).message)
        : 'Failed to load history'
      entries.value = []
      totalItems.value = 0
      totalPages.value = 0
      console.error('[useA11yIssueHistory] fetch failed', e)
    } finally {
      if (!options?.silent) loading.value = false
    }
  }

  function siteNameFor(entry: A11yIssueActionEntry): string | undefined {
    return entry.expand?.site?.name
      ?? sites.value.find(s => s.id === entry.site)?.name
  }

  watch([resolvedSiteId, filter], () => {
    page.value = 1
  })

  return {
    entries,
    loading,
    error,
    page,
    perPage,
    totalItems,
    totalPages,
    filter,
    search,
    isOrgScoped,
    fetchHistory,
    siteNameFor
  }
}
