import type { AccessibilityIssue, IssueFilters, Scan, WcagLevelFilter } from '~/types/accessiq'

const IMPACT_WEIGHTS: Record<string, number> = {
  critical: 4,
  serious: 3,
  moderate: 2,
  minor: 1
}

export function calculateAccessibilityScore(issues: AccessibilityIssue[]): number {
  if (issues.length === 0) return 100
  const totalWeight = issues.reduce((sum, i) => sum + (IMPACT_WEIGHTS[i.impact] || 1), 0)
  const maxPossible = issues.length * 4
  return Math.max(0, Math.round((1 - totalWeight / maxPossible) * 100))
}

export function useAccessibility(siteId: Ref<string> | string) {
  const { pb } = usePocketBase()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const latestScan = ref<Scan | null>(null)
  const issues = ref<AccessibilityIssue[]>([])
  const scans = ref<Scan[]>([])
  const loading = ref(false)

  const wcagLevel = useState<WcagLevelFilter>('a11y-wcag-level', () => 'All')
  const filters = useState<IssueFilters>('a11y-filters', () => ({
    wcagVersions: [],
    impacts: [],
    types: [],
    elements: [],
    roles: [],
    statuses: ['open']
  }))

  async function fetchLatestScan() {
    if (!id.value) return
    loading.value = true
    try {
      const result = await pb.collection('scans').getList(1, 1, {
        filter: `site = "${id.value}" && status = 'complete'`,
        sort: '-completed_at'
      })
      latestScan.value = result.items[0] as unknown as Scan

      if (latestScan.value) {
        const issueResult = await pb.collection('accessibility_issues').getFullList({
          filter: `scan = "${latestScan.value.id}"`,
          expand: 'page',
          sort: '-impact'
        })
        issues.value = issueResult as unknown as AccessibilityIssue[]
      } else {
        issues.value = []
      }

      const scanHistory = await pb.collection('scans').getFullList({
        filter: `site = "${id.value}" && status = 'complete'`,
        sort: '-completed_at',
        limit: 30
      })
      scans.value = scanHistory as unknown as Scan[]
    } finally {
      loading.value = false
    }
  }

  const levelCounts = computed(() => ({
    All: issues.value.filter(i => i.status !== 'dismissed').length,
    A: issues.value.filter(i => i.wcag_level === 'A' && i.status !== 'dismissed').length,
    AA: issues.value.filter(i => i.wcag_level === 'AA' && i.status !== 'dismissed').length,
    AAA: issues.value.filter(i => i.wcag_level === 'AAA' && i.status !== 'dismissed').length
  }))

  const filteredIssues = computed(() => {
    return issues.value.filter((issue) => {
      if (wcagLevel.value !== 'All' && issue.wcag_level !== wcagLevel.value) return false
      if (filters.value.wcagVersions.length && issue.wcag_version && !filters.value.wcagVersions.includes(issue.wcag_version)) return false
      if (filters.value.impacts.length && !filters.value.impacts.includes(issue.impact)) return false
      if (filters.value.types.length && !filters.value.types.includes(issue.type)) return false
      if (filters.value.elements.length && issue.element_type && !filters.value.elements.includes(issue.element_type)) return false
      if (filters.value.roles.length && issue.responsible_role && !filters.value.roles.includes(issue.responsible_role)) return false
      if (filters.value.statuses.length && !filters.value.statuses.includes(issue.status)) return false
      return true
    })
  })

  const compositeScore = computed(() => calculateAccessibilityScore(filteredIssues.value))

  async function dismissIssue(issueId: string, reason: string) {
    await pb.collection('accessibility_issues').update(issueId, {
      status: 'dismissed',
      dismiss_reason: reason,
      dismissed_at: new Date().toISOString()
    })
    await fetchLatestScan()
  }

  async function markFixed(issueId: string) {
    await pb.collection('accessibility_issues').update(issueId, { status: 'fixed' })
    await fetchLatestScan()
  }

  watch(id, fetchLatestScan, { immediate: true })

  return {
    latestScan,
    issues,
    scans,
    loading,
    wcagLevel,
    filters,
    levelCounts,
    filteredIssues,
    compositeScore,
    fetchLatestScan,
    dismissIssue,
    markFixed
  }
}
