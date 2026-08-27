import type { Policy } from '~/types/sitenook'
import { pbEmptyRelation, pbOr, pbRelation } from '~/utils/pbFilter'
import { requireUserOrganizationId } from '~/utils/orgAccess'

/** Sentinel for org-wide policies (empty `site` in PocketBase). */
export const POLICY_ALL_SITES = '__all__' as const

export type PolicyInput = {
  /** Site id, or empty / POLICY_ALL_SITES for all sites in the org. */
  site: string
  name: string
  description?: string
  kind: Policy['kind']
  rule_type: Policy['rule_type']
  pattern: string
  category: Policy['category']
  severity: Policy['severity']
  enabled?: boolean
}

function resolveSiteId(site: string | undefined): string {
  const trimmed = site?.trim() ?? ''
  if (!trimmed || trimmed === POLICY_ALL_SITES) return ''
  return trimmed
}

function normalizePolicyInput(input: PolicyInput): PolicyInput {
  const kind = input.kind === 'exclude_from_accessibility'
    ? 'exclude_from_accessibility'
    : 'flag_content'

  if (kind === 'exclude_from_accessibility') {
    return {
      ...input,
      kind,
      rule_type: 'css_selector',
      category: 'accessibility',
      severity: input.severity || 'warning'
    }
  }

  const ruleType = input.rule_type === 'css_selector' ? 'keyword' : input.rule_type
  return {
    ...input,
    kind,
    rule_type: ruleType
  }
}

export function usePolicies(siteFilter?: Ref<string | undefined>) {
  const { pb, requireUser } = usePocketBase()
  const policies = ref<Policy[]>([])
  const loading = ref(false)
  const loadError = ref<string | null>(null)

  async function fetchPolicies() {
    if (!pb) return
    loading.value = true
    loadError.value = null
    try {
      // When filtering to one site, include org-wide (empty site) policies too.
      const filter = siteFilter?.value
        ? pbOr([pbRelation('site', siteFilter.value), pbEmptyRelation('site')])
        : undefined
      policies.value = await pb.collection('policies').getFullList({
        filter,
        sort: '-created',
        expand: 'site'
      }) as unknown as Policy[]
    } catch (err) {
      loadError.value = err instanceof Error ? err.message : 'Failed to load policies'
      policies.value = []
    } finally {
      loading.value = false
    }
  }

  async function createPolicy(input: PolicyInput): Promise<Policy> {
    if (!pb) throw new Error('PocketBase unavailable')
    const user = requireUser()
    const organization = requireUserOrganizationId(user)
    const normalized = normalizePolicyInput(input)
    const site = resolveSiteId(normalized.site)
    const name = normalized.name?.trim()
    if (!name) throw new Error('Name is required')
    const pattern = normalized.pattern?.trim()
    if (!pattern) throw new Error(normalized.kind === 'exclude_from_accessibility'
      ? 'CSS selector is required'
      : 'Pattern is required')

    const record = await pb.collection('policies').create({
      organization,
      site: site || null,
      name,
      description: normalized.description?.trim() || '',
      kind: normalized.kind,
      rule_type: normalized.rule_type,
      pattern,
      category: normalized.category,
      severity: normalized.severity,
      enabled: normalized.enabled !== false
    }) as unknown as Policy

    await fetchPolicies()
    return record
  }

  async function updatePolicy(id: string, patch: Partial<PolicyInput>): Promise<Policy> {
    if (!pb) throw new Error('PocketBase unavailable')
    const current = policies.value.find(p => p.id === id)
    const payload: Record<string, unknown> = {}

    if (patch.site !== undefined) {
      const site = resolveSiteId(patch.site)
      payload.site = site || null
    }
    if (patch.name !== undefined) payload.name = patch.name.trim()
    if (patch.description !== undefined) payload.description = patch.description.trim()
    if (patch.enabled !== undefined) payload.enabled = patch.enabled

    const touchesShape = patch.kind !== undefined
      || patch.rule_type !== undefined
      || patch.pattern !== undefined
      || patch.category !== undefined
      || patch.severity !== undefined

    if (touchesShape) {
      const merged = normalizePolicyInput({
        site: patch.site ?? current?.site ?? POLICY_ALL_SITES,
        name: patch.name ?? current?.name ?? '',
        description: patch.description ?? current?.description ?? '',
        kind: patch.kind ?? current?.kind ?? 'flag_content',
        rule_type: patch.rule_type ?? current?.rule_type ?? 'keyword',
        pattern: patch.pattern ?? current?.pattern ?? '',
        category: patch.category ?? current?.category ?? 'qa',
        severity: patch.severity ?? current?.severity ?? 'warning',
        enabled: patch.enabled ?? current?.enabled
      })
      payload.kind = merged.kind
      payload.rule_type = merged.rule_type
      payload.pattern = merged.pattern.trim()
      payload.category = merged.category
      payload.severity = merged.severity
    }

    const record = await pb.collection('policies').update(id, payload) as unknown as Policy
    await fetchPolicies()
    return record
  }

  async function togglePolicy(id: string, enabled: boolean) {
    return updatePolicy(id, { enabled })
  }

  async function deletePolicy(id: string) {
    if (!pb) throw new Error('PocketBase unavailable')
    await pb.collection('policies').delete(id)
    await fetchPolicies()
  }

  if (siteFilter) {
    watch(siteFilter, () => {
      void fetchPolicies()
    })
  }

  onMounted(() => {
    void fetchPolicies()
  })

  return {
    policies,
    loading,
    loadError,
    fetchPolicies,
    createPolicy,
    updatePolicy,
    togglePolicy,
    deletePolicy
  }
}
