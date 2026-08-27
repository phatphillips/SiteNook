import type { AffectedPageSummary } from '~/utils/affectedPages'
import { reconcileSiteA11ySummary, updateIssueStatusAndReconcile } from '~/utils/a11yReconcile'
import type { DismissReason } from '~/utils/issueActions'
import {
  reopenIssuePatch,
  type A11yIssueActionCreateInput,
  type A11yIssueActionScope
} from '~/utils/a11yIssueHistory'
import type { Site } from '~/types/sitenook'
import { getUserOrganizationId } from '~/utils/orgAccess'
import { useA11yScoreRefresh } from '~/composables/useA11yScoreRefresh'

function pocketBaseErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const fetchError = error as { data?: { message?: string }, message?: string }
    if (fetchError.data?.message) return fetchError.data.message
    if (fetchError.message) return fetchError.message
  }
  return 'Request failed'
}

export interface OrgIssueActionContext {
  ruleId: string
  scope: A11yIssueActionScope
  pageUrl?: string
  pageTitle?: string
  description?: string
  impact?: string
  wcagLevel?: string
}

export interface OrgIssueActionResult {
  issueIds: string[]
  status: 'dismissed' | 'fixed' | 'reopened'
  context: OrgIssueActionContext
  siteId: string
}

export function useOrgA11yIssueActions(options?: {
  onRefresh?: () => Promise<void>
  loadAffectedPagesForRule?: (ruleId: string, siteId?: string) => Promise<AffectedPageSummary[]>
}) {
  const onRefresh = options?.onRefresh
  const loadAffectedPagesForRule = options?.loadAffectedPagesForRule
  const { pb, awaitAuthReady } = usePocketBase()
  const { triggerScan, sites } = useSites()
  const toast = useToast()
  const { beginScoreRefresh, endScoreRefresh, bumpHistoryRevision } = useA11yScoreRefresh()
  const rescanningPageUrl = ref<string | null>(null)
  const actionBusy = ref(false)

  function currentActorId(): string | undefined {
    return pb?.authStore.record?.id
  }

  function resolveOrganizationId(siteId: string): string | undefined {
    const site = sites.value.find((s: Site) => s.id === siteId)
    if (site?.organization) return site.organization
    const record = pb?.authStore.record
    if (record) {
      return getUserOrganizationId(record) ?? undefined
    }
    return undefined
  }

  async function logIssueAction(
    siteId: string,
    input: Omit<A11yIssueActionCreateInput, 'organization' | 'site' | 'logged_at'>
  ) {
    if (!pb) return
    const organization = resolveOrganizationId(siteId)
    if (!organization) return

    try {
      const payload: Record<string, unknown> = {
        organization,
        site: siteId,
        action: input.action,
        scope: input.scope,
        rule_id: input.rule_id,
        description: input.description ?? '',
        page_url: input.page_url ?? '',
        page_title: input.page_title ?? '',
        dismiss_reason: input.dismiss_reason ?? '',
        issue_ids: input.issue_ids ?? [],
        logged_at: new Date().toISOString()
      }
      const actor = input.actor ?? currentActorId()
      if (actor) payload.actor = actor
      if (input.impact) payload.impact = input.impact
      if (input.wcag_level) payload.wcag_level = input.wcag_level

      await pb.collection('accessibility_issue_actions').create(payload)
    } catch (error) {
      console.warn('[a11y] failed to write issue action history', error)
    }
  }

  async function collectIssueIdsForRule(siteId: string, ruleId: string): Promise<string[]> {
    if (!siteId || !ruleId) return []

    let pages: AffectedPageSummary[] = []
    if (loadAffectedPagesForRule) {
      pages = await loadAffectedPagesForRule(ruleId, siteId)
    } else {
      await awaitAuthReady()
      const token = pb?.authStore.token
      if (!token) return []

      const response = await $fetch<{ pages: AffectedPageSummary[] }>(
        `/api/sites/${siteId}/accessibility/issues/${encodeURIComponent(ruleId)}/pages`,
        {
          headers: { Authorization: `Bearer ${token}` },
          timeout: 60_000
        }
      )
      pages = response.pages ?? []
    }

    const ids = new Set<string>()
    for (const page of pages) {
      for (const id of page.issueIds ?? []) ids.add(id)
    }
    return [...ids]
  }

  async function updateIssueRecords(
    siteId: string,
    issueIds: string[],
    patch: Record<string, unknown>,
    successTitle: string,
    history?: Omit<A11yIssueActionCreateInput, 'organization' | 'site' | 'logged_at'>
  ): Promise<string[]> {
    if (!issueIds.length || !pb || !siteId) return []

    actionBusy.value = true
    beginScoreRefresh(siteId)
    try {
      await Promise.all(
        issueIds.map(issueId =>
          updateIssueStatusAndReconcile(pb, siteId, issueId, patch)
        )
      )

      if (history) {
        await logIssueAction(siteId, history)
        bumpHistoryRevision()
      }

      toast.add({ title: successTitle })

      const token = pb.authStore.token
      if (token) {
        void reconcileSiteA11ySummary(siteId, token)
          .catch(() => {})
          .finally(() => endScoreRefresh(siteId))
      } else {
        endScoreRefresh(siteId)
      }

      return issueIds
    } catch (error: unknown) {
      endScoreRefresh(siteId)
      toast.add({
        title: 'Could not update issue',
        description: pocketBaseErrorMessage(error),
        color: 'error'
      })
      throw error
    } finally {
      actionBusy.value = false
    }
  }

  async function dismissRule(
    siteId: string,
    ruleId: string,
    reason: DismissReason,
    meta?: Partial<OrgIssueActionContext>
  ): Promise<OrgIssueActionResult> {
    const issueIds = await collectIssueIdsForRule(siteId, ruleId)
    const now = new Date().toISOString()
    const actor = currentActorId()
    await updateIssueRecords(siteId, issueIds, {
      status: 'dismissed',
      dismissed_at: now,
      dismiss_reason: reason,
      ...(actor ? { dismissed_by: actor } : {})
    }, issueIds.length === 1 ? 'Issue dismissed' : `${issueIds.length} issues dismissed`, {
      actor,
      action: 'dismissed',
      scope: 'rule',
      rule_id: ruleId,
      description: meta?.description,
      impact: meta?.impact,
      wcag_level: meta?.wcagLevel,
      dismiss_reason: reason,
      issue_ids: issueIds
    })
    return {
      issueIds,
      status: 'dismissed',
      siteId,
      context: { ruleId, scope: 'rule', ...meta }
    }
  }

  async function dismissRulePage(
    siteId: string,
    ruleId: string,
    pageUrl: string,
    reason: DismissReason,
    issueIds?: string[],
    meta?: Partial<OrgIssueActionContext>
  ): Promise<OrgIssueActionResult> {
    if (!issueIds?.length) {
      toast.add({ title: 'No open issues to dismiss on this page', color: 'warning' })
      return { issueIds: [], status: 'dismissed', siteId, context: { ruleId, scope: 'page', pageUrl } }
    }
    const now = new Date().toISOString()
    const actor = currentActorId()
    await updateIssueRecords(siteId, issueIds, {
      status: 'dismissed',
      dismissed_at: now,
      dismiss_reason: reason,
      ...(actor ? { dismissed_by: actor } : {})
    }, issueIds.length === 1 ? 'Issue dismissed' : `${issueIds.length} issues dismissed`, {
      actor,
      action: 'dismissed',
      scope: 'page',
      rule_id: ruleId,
      description: meta?.description,
      impact: meta?.impact,
      wcag_level: meta?.wcagLevel,
      page_url: pageUrl,
      page_title: meta?.pageTitle,
      dismiss_reason: reason,
      issue_ids: issueIds
    })
    return {
      issueIds,
      status: 'dismissed',
      siteId,
      context: { ruleId, scope: 'page', pageUrl, ...meta }
    }
  }

  async function markRuleFixed(
    siteId: string,
    ruleId: string,
    meta?: Partial<OrgIssueActionContext>
  ): Promise<OrgIssueActionResult> {
    const issueIds = await collectIssueIdsForRule(siteId, ruleId)
    const actor = currentActorId()
    await updateIssueRecords(siteId, issueIds, {
      status: 'fixed',
      ...(actor ? { dismissed_by: actor } : {}),
      dismissed_at: new Date().toISOString()
    }, issueIds.length === 1 ? 'Issue marked as fixed' : `${issueIds.length} issues marked as fixed`, {
      actor,
      action: 'fixed',
      scope: 'rule',
      rule_id: ruleId,
      description: meta?.description,
      impact: meta?.impact,
      wcag_level: meta?.wcagLevel,
      issue_ids: issueIds
    })
    return {
      issueIds,
      status: 'fixed',
      siteId,
      context: { ruleId, scope: 'rule', ...meta }
    }
  }

  async function markRulePage(
    siteId: string,
    ruleId: string,
    pageUrl: string,
    issueIds?: string[],
    meta?: Partial<OrgIssueActionContext>
  ): Promise<OrgIssueActionResult> {
    if (!issueIds?.length) {
      toast.add({ title: 'No open issues to mark fixed on this page', color: 'warning' })
      return { issueIds: [], status: 'fixed', siteId, context: { ruleId, scope: 'page', pageUrl } }
    }
    const actor = currentActorId()
    await updateIssueRecords(siteId, issueIds, {
      status: 'fixed',
      ...(actor ? { dismissed_by: actor } : {}),
      dismissed_at: new Date().toISOString()
    }, issueIds.length === 1 ? 'Issue marked as fixed' : `${issueIds.length} issues marked as fixed`, {
      actor,
      action: 'fixed',
      scope: 'page',
      rule_id: ruleId,
      description: meta?.description,
      impact: meta?.impact,
      wcag_level: meta?.wcagLevel,
      page_url: pageUrl,
      page_title: meta?.pageTitle,
      issue_ids: issueIds
    })
    return {
      issueIds,
      status: 'fixed',
      siteId,
      context: { ruleId, scope: 'page', pageUrl, ...meta }
    }
  }

  async function reopenIssues(
    siteId: string,
    issueIds: string[],
    context: OrgIssueActionContext
  ): Promise<OrgIssueActionResult> {
    const actor = currentActorId()
    await updateIssueRecords(
      siteId,
      issueIds,
      reopenIssuePatch(),
      issueIds.length === 1 ? 'Issue reopened' : `${issueIds.length} issues reopened`,
      {
        actor,
        action: 'reopened',
        scope: context.scope,
        rule_id: context.ruleId,
        description: context.description,
        impact: context.impact,
        wcag_level: context.wcagLevel,
        page_url: context.pageUrl,
        page_title: context.pageTitle,
        issue_ids: issueIds
      }
    )
    return { issueIds, status: 'reopened', siteId, context }
  }

  async function rescanPage(siteId: string, pageUrl: string) {
    if (!siteId || !pageUrl) return
    rescanningPageUrl.value = pageUrl
    try {
      await triggerScan(siteId, 'full', pageUrl)
      toast.add({ title: 'Page scan queued' })
      await onRefresh?.()
    } catch (error: unknown) {
      toast.add({
        title: 'Could not queue scan',
        description: pocketBaseErrorMessage(error),
        color: 'error'
      })
    } finally {
      rescanningPageUrl.value = null
    }
  }

  return {
    rescanningPageUrl,
    actionBusy,
    dismissRule,
    dismissRulePage,
    markRuleFixed,
    markRulePage,
    reopenIssues,
    rescanPage
  }
}
