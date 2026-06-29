/** Trigger server-side rebuild of sites.current_a11y after issue status changes. */
export async function reconcileSiteA11ySummary(siteId: string, token: string): Promise<void> {
  await $fetch(`/api/sites/${siteId}/accessibility/reconcile-current`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` }
  })
}

/** Update issue status and refresh the site accessibility summary. */
export async function updateIssueStatusAndReconcile(
  pb: ReturnType<typeof usePocketBase>['pb'],
  siteId: string,
  issueId: string,
  patch: Record<string, unknown>
): Promise<void> {
  await pb.collection('accessibility_issues').update(issueId, patch)
  const token = pb.authStore.token
  if (token) {
    await reconcileSiteA11ySummary(siteId, token).catch(() => {})
  }
}
