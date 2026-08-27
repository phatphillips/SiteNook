import type { Ref } from 'vue'
import type { AccessibilityIssue, Site } from '~/types/sitenook'
import { openIssueIdsForPage, openIssueIdsForRule, openIssueIdsForRuleAndPage } from '~/utils/affectedPages'
import { reconcileSiteA11ySummary, updateIssueStatusAndReconcile } from '~/utils/a11yReconcile'
import type { DismissReason } from '~/utils/issueActions'
import {
  reopenIssuePatch,
  type A11yIssueActionCreateInput,
  type A11yIssueActionScope
} from '~/utils/a11yIssueHistory'
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

export interface IssueActionContext {
  ruleId: string
  scope: A11yIssueActionScope
  pageUrl?: string
  pageTitle?: string
  description?: string
  impact?: string
  wcagLevel?: string
}

export interface IssueActionResult {
  issueIds: string[]
  status: 'dismissed' | 'fixed' | 'reopened'
  context: IssueActionContext
}

export function useA11yIssueActions(
  siteId: Ref<string> | string,
  issues: Ref<AccessibilityIssue[]>
) {
  const { pb } = usePocketBase()
  const toast = useToast()
  const { triggerScan, sites } = useSites()
  const { beginScoreRefresh, endScoreRefresh, bumpHistoryRevision } = useA11yScoreRefresh()
  const id = computed(() => (typeof siteId === 'object' ? siteId.value : siteId))

  const rescanningPageUrl = ref<string | null>(null)
  const actionBusy = ref(false)

  function applyLocalIssuePatch(issueIds: string[], patch: Record<string, unknown>) {
    if (!issueIds.length) return
    const idSet = new Set(issueIds)
    // Mutate in place — `issues` is often a computed from useAccessibility.
    for (const issue of issues.value) {
      if (!idSet.has(issue.id)) continue
      Object.assign(issue, patch)
    }
  }

  function currentActorId(): string | undefined {
    return pb?.authStore.record?.id
  }

  function resolveOrganizationId(): string | undefined {
    const site = sites.value.find((s: Site) => s.id === id.value)
    if (site?.organization) return site.organization
    const record = pb?.authStore.record
    if (record) {
      return getUserOrganizationId(record) ?? undefined
    }
    return undefined
  }

  async function logIssueAction(input: Omit<A11yIssueActionCreateInput, 'organization' | 'site' | 'logged_at'> & {
    organization?: string
    site?: string
  }) {
    if (!pb) return
    const organization = input.organization ?? resolveOrganizationId()
    const site = input.site ?? id.value
    if (!organization || !site) return

    try {
      const payload: Record<string, unknown> = {
        organization,
        site,
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

  async function updateIssueRecords(
    issueIds: string[],
    patch: Record<string, unknown>,
    successTitle: string,
    history?: Omit<A11yIssueActionCreateInput, 'organization' | 'site' | 'logged_at' | 'issue_ids'> & {
      issue_ids?: string[]
    }
  ): Promise<string[]> {
    if (!issueIds.length || !pb || !id.value) return []

    const siteKey = id.value
    actionBusy.value = true
    beginScoreRefresh(siteKey)
    applyLocalIssuePatch(issueIds, patch)
    try {
      await Promise.all(
        issueIds.map(issueId =>
          updateIssueStatusAndReconcile(pb, siteKey, issueId, patch)
        )
      )

      // History is a single create — await it so the drawer shows the entry immediately.
      if (history) {
        await logIssueAction({
          ...history,
          issue_ids: history.issue_ids ?? issueIds
        })
        bumpHistoryRevision()
      }

      toast.add({ title: successTitle })

      // Reconcile can take several seconds; do not block toast / UI on it.
      const token = pb.authStore.token
      if (token) {
        void reconcileSiteA11ySummary(siteKey, token)
          .catch(() => {})
          .finally(() => endScoreRefresh(siteKey))
      } else {
        endScoreRefresh(siteKey)
      }

      return issueIds
    } catch (error: unknown) {
      endScoreRefresh(siteKey)
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

  function snapshotForRule(ruleId: string): Partial<IssueActionContext> {
    const sample = issues.value.find(issue => issue.rule_id === ruleId)
    return {
      ruleId,
      description: sample?.description,
      impact: sample?.impact,
      wcagLevel: sample?.wcag_level
    }
  }

  async function dismissIssues(
    issueIds: string[],
    reason: DismissReason,
    context: IssueActionContext
  ): Promise<IssueActionResult> {
    const now = new Date().toISOString()
    const actor = currentActorId()
    await updateIssueRecords(issueIds, {
      status: 'dismissed',
      dismissed_at: now,
      dismiss_reason: reason,
      ...(actor ? { dismissed_by: actor } : {})
    }, issueIds.length === 1 ? 'Issue dismissed' : `${issueIds.length} issues dismissed`, {
      actor,
      action: 'dismissed',
      scope: context.scope,
      rule_id: context.ruleId,
      description: context.description,
      impact: context.impact,
      wcag_level: context.wcagLevel,
      page_url: context.pageUrl,
      page_title: context.pageTitle,
      dismiss_reason: reason,
      issue_ids: issueIds
    })
    return { issueIds, status: 'dismissed', context }
  }

  async function markIssuesFixed(
    issueIds: string[],
    context: IssueActionContext
  ): Promise<IssueActionResult> {
    const actor = currentActorId()
    await updateIssueRecords(issueIds, {
      status: 'fixed',
      ...(actor ? { dismissed_by: actor } : {}),
      dismissed_at: new Date().toISOString()
    }, issueIds.length === 1 ? 'Issue marked as fixed' : `${issueIds.length} issues marked as fixed`, {
      actor,
      action: 'fixed',
      scope: context.scope,
      rule_id: context.ruleId,
      description: context.description,
      impact: context.impact,
      wcag_level: context.wcagLevel,
      page_url: context.pageUrl,
      page_title: context.pageTitle,
      issue_ids: issueIds
    })
    return { issueIds, status: 'fixed', context }
  }

  async function dismissRule(ruleId: string, reason: DismissReason): Promise<IssueActionResult> {
    const issueIds = openIssueIdsForRule(issues.value, ruleId)
    const snap = snapshotForRule(ruleId)
    return dismissIssues(issueIds, reason, {
      ruleId,
      scope: 'rule',
      description: snap.description,
      impact: snap.impact,
      wcagLevel: snap.wcagLevel
    })
  }

  async function dismissRulePage(
    ruleId: string,
    pageUrl: string,
    reason: DismissReason,
    issueIds?: string[],
    pageTitle?: string
  ): Promise<IssueActionResult> {
    const ids = issueIds?.length
      ? issueIds
      : openIssueIdsForRuleAndPage(issues.value, ruleId, pageUrl)
    const snap = snapshotForRule(ruleId)
    return dismissIssues(ids, reason, {
      ruleId,
      scope: 'page',
      pageUrl,
      pageTitle,
      description: snap.description,
      impact: snap.impact,
      wcagLevel: snap.wcagLevel
    })
  }

  async function dismissPage(pageUrl: string, reason: DismissReason): Promise<IssueActionResult> {
    const issueIds = openIssueIdsForPage(issues.value, pageUrl)
    const sample = issues.value.find(issue => issue.expand?.page?.url === pageUrl)
    return dismissIssues(issueIds, reason, {
      ruleId: sample?.rule_id ?? 'page',
      scope: 'page',
      pageUrl,
      pageTitle: sample?.expand?.page?.title,
      description: sample?.description,
      impact: sample?.impact,
      wcagLevel: sample?.wcag_level
    })
  }

  async function markRuleFixed(ruleId: string): Promise<IssueActionResult> {
    const snap = snapshotForRule(ruleId)
    return markIssuesFixed(openIssueIdsForRule(issues.value, ruleId), {
      ruleId,
      scope: 'rule',
      description: snap.description,
      impact: snap.impact,
      wcagLevel: snap.wcagLevel
    })
  }

  async function markRulePage(
    ruleId: string,
    pageUrl: string,
    issueIds?: string[],
    pageTitle?: string
  ): Promise<IssueActionResult> {
    const ids = issueIds?.length
      ? issueIds
      : openIssueIdsForRuleAndPage(issues.value, ruleId, pageUrl)
    const snap = snapshotForRule(ruleId)
    return markIssuesFixed(ids, {
      ruleId,
      scope: 'page',
      pageUrl,
      pageTitle,
      description: snap.description,
      impact: snap.impact,
      wcagLevel: snap.wcagLevel
    })
  }

  async function markPageFixed(pageUrl: string): Promise<IssueActionResult> {
    const issueIds = openIssueIdsForPage(issues.value, pageUrl)
    const sample = issues.value.find(issue => issue.expand?.page?.url === pageUrl)
    return markIssuesFixed(issueIds, {
      ruleId: sample?.rule_id ?? 'page',
      scope: 'page',
      pageUrl,
      pageTitle: sample?.expand?.page?.title,
      description: sample?.description,
      impact: sample?.impact,
      wcagLevel: sample?.wcag_level
    })
  }

  async function reopenIssues(
    issueIds: string[],
    context: IssueActionContext
  ): Promise<IssueActionResult> {
    const actor = currentActorId()
    await updateIssueRecords(
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
    return { issueIds, status: 'reopened', context }
  }

  async function rescanPage(pageUrl: string, onRefresh?: () => Promise<void>) {
    if (!id.value || !pageUrl) return
    rescanningPageUrl.value = pageUrl
    try {
      await triggerScan(id.value, 'full', pageUrl)
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
    dismissPage,
    markRuleFixed,
    markRulePage,
    markPageFixed,
    reopenIssues,
    rescanPage,
    logIssueAction
  }
}
