<script setup lang="ts">
import type { Organization } from '~/types/sitenook'
import type { BillingInterval } from '~/utils/planPricing'
import type { PlanChangeAssessment, OrganizationPlanUsage } from '~/utils/planEligibility'
import type { PaidCheckoutPlan } from '~/utils/planLimits'
import { formatPlanPrice, getPlanOffering, PAID_PLAN_OFFERINGS } from '~/utils/planPricing'
import { formatRequestError } from '~/utils/pbClientError'
import { trackFunnelEvent } from '~/utils/funnelAnalytics'

const props = withDefaults(defineProps<{
  organization: Organization | null
  usage: OrganizationPlanUsage | null
  currentPlan: PaidCheckoutPlan | 'free' | 'enterprise'
  planChanges: PlanChangeAssessment[]
  stripeCheckoutConfigured: boolean
  annualCheckoutConfigured?: boolean
  reinstateMode?: boolean
  disabled?: boolean
  embedded?: boolean
}>(), {
  embedded: false
})

const emit = defineEmits<{
  organizationUpdated: [organization: Organization]
}>()

const { pb } = usePocketBase()
const toast = useToast()

const billingInterval = ref<BillingInterval>('annual')
const loadingPlan = ref<PaidCheckoutPlan | null>(null)
const expandedBlockers = ref<PaidCheckoutPlan | null>(null)

const annualToggleEnabled = computed(() => props.annualCheckoutConfigured === true)

watch(
  () => props.annualCheckoutConfigured,
  (enabled) => {
    if (!enabled && billingInterval.value === 'annual') {
      billingInterval.value = 'monthly'
    }
  },
  { immediate: true }
)
const paidPlans = computed(() => PAID_PLAN_OFFERINGS.filter(plan => !plan.contactSales))

function assessmentFor(plan: PaidCheckoutPlan): PlanChangeAssessment | undefined {
  return props.planChanges.find(change => change.targetPlan === plan)
}

function planActionLabel(assessment: PlanChangeAssessment, plan: PaidCheckoutPlan): string {
  if (props.reinstateMode && assessment.direction !== 'same') {
    return `Choose ${getPlanOffering(plan)?.name}`
  }
  if (assessment.direction === 'same') return 'Your current plan'
  return 'Choose plan'
}

function canSelectPlan(plan: PaidCheckoutPlan, assessment?: PlanChangeAssessment): boolean {
  if (props.disabled || !assessment) return false
  if (props.reinstateMode) {
    return assessment.direction !== 'downgrade' || assessment.eligible
  }
  if (assessment.direction === 'same') return false
  return assessment.direction !== 'downgrade' || assessment.eligible
}

function buttonVariant(plan: PaidCheckoutPlan, assessment?: PlanChangeAssessment): 'solid' | 'outline' | 'soft' {
  if (!assessment) return 'outline'
  if (isCurrentPlan(plan) && !props.reinstateMode) return 'soft'
  if (canSelectPlan(plan, assessment)) return 'solid'
  return 'outline'
}

function isCurrentPlan(plan: PaidCheckoutPlan): boolean {
  return props.currentPlan === plan
}

async function changePlan(plan: PaidCheckoutPlan) {
  const assessment = assessmentFor(plan)
  if (!assessment || props.disabled) return
  if (!props.reinstateMode && assessment.direction === 'same') return
  if (assessment.direction === 'downgrade' && !assessment.eligible) {
    expandedBlockers.value = expandedBlockers.value === plan ? null : plan
    return
  }

  if (!pb?.authStore.token) return
  loadingPlan.value = plan
  trackFunnelEvent('upgrade_click', {
    organizationId: props.organization?.id,
    plan,
    interval: billingInterval.value,
    source: 'billing_plan_change'
  })
  try {
    const result = await $fetch<{
      mode: 'checkout' | 'portal' | 'updated'
      url?: string
      organization?: Organization
      plan?: PaidCheckoutPlan
    }>('/api/stripe/change-plan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pb.authStore.token}` },
      body: { plan, interval: billingInterval.value }
    })

    if (result.mode === 'updated' && result.organization) {
      emit('organizationUpdated', result.organization)
      toast.add({
        title: props.reinstateMode ? 'Subscription restored' : 'Plan updated',
        description: props.reinstateMode
          ? `Your organization is back on the ${getPlanOffering(result.plan ?? plan)?.name ?? plan} plan.`
          : `Your organization is now on the ${getPlanOffering(result.plan ?? plan)?.name ?? plan} plan.`,
        color: 'success'
      })
      return
    }

    if (result.url) {
      window.location.assign(result.url)
    }
  } catch (error: unknown) {
    if (readBlockersFromError(error).length) {
      expandedBlockers.value = plan
    }
    toast.add({
      title: 'Could not change plan',
      description: formatRequestError(error, 'Could not change plan. Please try again.'),
      color: 'error'
    })
  } finally {
    loadingPlan.value = null
  }
}

function readBlockersFromError(error: unknown) {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { blockers?: PlanChangeAssessment['blockers'] } }).data
    return data?.blockers ?? []
  }
  return []
}

function planCardClass(planId: PaidCheckoutPlan): string {
  return isCurrentPlan(planId) && !props.reinstateMode
    ? 'border-default bg-elevated/40'
    : 'border-default bg-elevated/20'
}
</script>

<template>
  <component :is="embedded ? 'div' : 'UCard'">
    <div class="space-y-6">
      <div
        v-if="!embedded"
        class="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"
      >
        <div>
          <h3 class="text-base font-semibold text-highlighted">
            {{ reinstateMode ? 'Resubscribe' : 'Change plan' }}
          </h3>
          <p class="mt-1 text-sm text-muted leading-relaxed">
            {{ reinstateMode
              ? 'Pick a plan to start a new subscription. Your existing sites and data stay in place.'
              : 'Upgrades apply immediately. Downgrades require your usage to fit the target plan limits.' }}
          </p>
        </div>
        <div class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 p-1 shrink-0">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="billingInterval === 'monthly'
              ? 'bg-[var(--color-action-solid)] text-[var(--color-action-solid-text)] shadow-sm'
              : 'text-muted hover:text-highlighted'"
            @click="billingInterval = 'monthly'"
          >
            Monthly
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="billingInterval === 'annual'
              ? 'bg-[var(--color-action-solid)] text-[var(--color-action-solid-text)] shadow-sm'
              : 'text-muted hover:text-highlighted'"
            :disabled="!annualToggleEnabled"
            :title="annualToggleEnabled ? undefined : 'Annual prices are not configured in Stripe yet.'"
            @click="billingInterval = 'annual'"
          >
            Annual
          </button>
        </div>
      </div>

      <div
        v-else
        class="flex flex-col items-center gap-2"
      >
        <div class="flex items-center gap-2 rounded-lg border border-default bg-elevated/40 p-1">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="billingInterval === 'monthly'
              ? 'bg-[var(--color-action-solid)] text-[var(--color-action-solid-text)] shadow-sm'
              : 'text-muted hover:text-highlighted'"
            @click="billingInterval = 'monthly'"
          >
            Monthly
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
            :class="billingInterval === 'annual'
              ? 'bg-[var(--color-action-solid)] text-[var(--color-action-solid-text)] shadow-sm'
              : 'text-muted hover:text-highlighted'"
            :disabled="!annualToggleEnabled"
            @click="billingInterval = 'annual'"
          >
            Annual
          </button>
        </div>
        <p
          v-if="annualToggleEnabled"
          class="text-xs text-muted"
        >
          Save when billed annually
        </p>
      </div>

      <div class="grid gap-4 lg:grid-cols-3">
        <div
          v-for="plan in paidPlans"
          :key="plan.id"
          class="flex flex-col rounded-xl border p-4"
          :class="planCardClass(plan.id)"
        >
          <div class="flex items-start justify-between gap-2">
            <div>
              <h4 class="font-semibold text-highlighted">
                {{ plan.name }}
              </h4>
              <p class="mt-1 text-xs text-muted leading-relaxed">
                {{ plan.description }}
              </p>
            </div>
            <UBadge
              v-if="isCurrentPlan(plan.id) && !reinstateMode"
              color="neutral"
              variant="subtle"
              size="sm"
            >
              Current plan
            </UBadge>
          </div>

          <p class="mt-4 text-2xl font-semibold text-highlighted tabular-nums">
            {{ formatPlanPrice(plan, billingInterval).priceLabel }}
            <span class="text-sm font-normal text-muted">
              {{ formatPlanPrice(plan, billingInterval).priceDetail }}
            </span>
          </p>

          <ul class="mt-4 flex-1 space-y-2 text-xs text-muted">
            <li
              v-for="feature in plan.features.slice(0, 5)"
              :key="feature"
              class="flex items-start gap-2"
            >
              <UIcon name="i-lucide-check" class="mt-0.5 size-3.5 shrink-0 text-default" />
              <span>{{ feature }}</span>
            </li>
          </ul>

          <div class="mt-5">
            <UButton
              v-if="assessmentFor(plan.id)"
              block
              color="neutral"
              :variant="buttonVariant(plan.id, assessmentFor(plan.id))"
              :disabled="!canSelectPlan(plan.id, assessmentFor(plan.id)) || !stripeCheckoutConfigured"
              :loading="loadingPlan === plan.id"
              @click="changePlan(plan.id)"
            >
              {{ assessmentFor(plan.id) ? planActionLabel(assessmentFor(plan.id)!, plan.id) : 'Unavailable' }}
            </UButton>
          </div>

          <div
            v-if="assessmentFor(plan.id)?.direction === 'downgrade' && !assessmentFor(plan.id)?.eligible"
            class="mt-3"
          >
            <button
              type="button"
              class="text-xs text-default underline underline-offset-2"
              @click="expandedBlockers = expandedBlockers === plan.id ? null : plan.id"
            >
              {{ expandedBlockers === plan.id ? 'Hide' : 'Show' }} steps to become eligible
            </button>
            <ul
              v-if="expandedBlockers === plan.id"
              class="mt-2 space-y-2 text-xs text-muted"
            >
              <li
                v-for="blocker in assessmentFor(plan.id)?.blockers"
                :key="blocker.id"
                class="rounded-md border border-default/70 bg-elevated/40 p-2"
              >
                <p class="font-medium text-default">
                  {{ blocker.message }}
                </p>
                <p class="mt-1">
                  {{ blocker.remediation }}
                </p>
                <NuxtLink
                  v-if="blocker.settingsPath"
                  :to="blocker.settingsPath"
                  class="mt-1 inline-block underline underline-offset-2"
                >
                  Go to settings &rarr;
                </NuxtLink>
              </li>
            </ul>
          </div>
        </div>
      </div>

      <p class="text-xs text-muted leading-relaxed">
        To move to the Free plan, cancel your subscription via
        <strong class="font-medium text-default">Manage in Stripe</strong>.
        Your account stays accessible for 30 days during retention.
      </p>
    </div>
  </component>
</template>
