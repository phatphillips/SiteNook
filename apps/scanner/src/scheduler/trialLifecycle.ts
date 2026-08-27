import type PocketBase from 'pocketbase'

const TRIAL_DAYS = 30

export interface TrialLifecycleResult {
  expired: number
  nudged: number
  errors: number
}

function daysRemainingUntil(iso: string, now: Date): number {
  const end = new Date(iso)
  if (Number.isNaN(end.getTime())) return 0
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)))
}

function resolveNudgeStage(daysRemaining: number, currentStage: number): number | null {
  const stage = Number.isFinite(currentStage) ? currentStage : 0
  if (daysRemaining <= 0) {
    return stage === -1 ? null : -1
  }
  if (daysRemaining <= 1 && stage !== 1 && stage !== -1) return 1
  if (daysRemaining <= 3 && daysRemaining > 1 && stage !== 3 && stage !== 1 && stage !== -1) return 3
  if (daysRemaining <= 7 && daysRemaining > 3 && stage !== 7 && stage !== 3 && stage !== 1 && stage !== -1) {
    return 7
  }
  return null
}

async function notifyTrial(
  pb: PocketBase,
  path: 'notify-trial-nudge' | 'notify-trial-expired',
  body: Record<string, unknown>
): Promise<void> {
  const pbUrl = (process.env.POCKETBASE_URL || 'http://localhost:8090').replace(/\/$/, '')
  const token = pb.authStore.token
  if (!token) return

  const response = await fetch(`${pbUrl}/api/sitenook/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`${path} failed: ${response.status} ${text}`)
  }
}

/**
 * Downgrade expired app-managed Team trials to Free and send day-7/3/1 nudge emails.
 * Skips orgs that already have a Stripe subscription id (Stripe owns that trial clock).
 */
export async function processTeamTrialLifecycle(pb: PocketBase): Promise<TrialLifecycleResult> {
  const now = new Date()
  const result: TrialLifecycleResult = { expired: 0, nudged: 0, errors: 0 }

  let page = 1
  const perPage = 100

  while (true) {
    const list = await pb.collection('organizations').getList(page, perPage, {
      filter: 'subscription_status = "trialing" && trial_ends_at != "" && stripe_subscription_id = ""',
      fields: 'id,plan,subscription_status,trial_ends_at,trial_nudge_stage,stripe_subscription_id'
    })

    for (const org of list.items) {
      try {
        const trialEndsAt = String(org.trial_ends_at || '').trim()
        if (!trialEndsAt) continue

        const remaining = daysRemainingUntil(trialEndsAt, now)
        const currentStage = Number(org.trial_nudge_stage ?? 0)

        if (remaining <= 0) {
          await pb.collection('organizations').update(org.id, {
            plan: 'free',
            subscription_status: 'none',
            trial_ends_at: null,
            trial_nudge_stage: -1
          })
          await notifyTrial(pb, 'notify-trial-expired', { organizationId: org.id })
          result.expired += 1
          continue
        }

        const nextStage = resolveNudgeStage(remaining, Number.isFinite(currentStage) ? currentStage : 0)
        if (nextStage === null || nextStage < 0) continue

        await pb.collection('organizations').update(org.id, {
          trial_nudge_stage: nextStage
        })
        await notifyTrial(pb, 'notify-trial-nudge', {
          organizationId: org.id,
          daysRemaining: nextStage === 1 ? 1 : nextStage
        })
        result.nudged += 1
      } catch (error) {
        result.errors += 1
        console.error('[trialLifecycle] org', org.id, error)
      }
    }

    if (page >= list.totalPages) break
    page += 1
  }

  return result
}

export { TRIAL_DAYS }
