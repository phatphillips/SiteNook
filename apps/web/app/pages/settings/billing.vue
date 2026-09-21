<script setup lang="ts">
import type { Organization } from '~/types/sitenook'
import type { PlanChangeAssessment, OrganizationPlanUsage } from '~/utils/planEligibility'
import type { UsageBreakdownRow, UsageLimitSummary } from '~/utils/planUsageBreakdown'
import { getPlanOffering, formatPlanPrice, TEAM_TRIAL_CTA } from '~/utils/planPricing'
import { isPaidCheckoutPlan, normalizeOrganizationPlan } from '~/utils/planLimits'
import { isOrgAdmin } from '~/utils/orgAccess'
import { formatPbClientError } from '~/utils/pbClientError'
import { trackFunnelEvent } from '~/utils/funnelAnalytics'
import type { BillingInvoiceSummary, BillingSubscriptionSummary } from '~/utils/billingTypes'

definePageMeta({ middleware: ['auth', 'commercial-only'] })

const route = useRoute()
const { sessionUser, awaitAuthReady, syncAuth, pb } = usePocketBase()
const toast = useToast()
const config = useRuntimeConfig()

const pageReady = ref(false)
const loading = ref(true)
const invoicesLoading = ref(false)
const syncLoading = ref(false)
const portalLoading = ref(false)
const adjustPlanOpen = ref(false)
const org = ref<Organization | null>(null)
const usage = ref<OrganizationPlanUsage | null>(null)
const usageRows = ref<UsageBreakdownRow[]>([])
const usageLimits = ref<UsageLimitSummary | null>(null)
const planChanges = ref<PlanChangeAssessment[]>([])
const subscription = ref<BillingSubscriptionSummary | null>(null)
const invoices = ref<BillingInvoiceSummary[]>([])
const billingSummaryStripeConfigured = ref(false)
const annualCheckoutConfigured = ref(false)
const stripeCancelPending = ref(false)
const portalReturnHandled = ref(false)
const upgradeReturnHandled = ref(false)

const stripeCheckoutConfigured = computed(() => {
  const value = String(config.public.stripeCheckoutConfigured ?? '').trim().toLowerCase()
  const runtimeFlag = value === 'true' || value === '1' || value === 'yes'
  return runtimeFlag || billingSummaryStripeConfigured.value
})

const canChangePlan = computed(() =>
  canManageBilling.value
  && !isOrgClosing.value
  && stripeCheckoutConfigured.value
)

const reinstateMode = computed(() => isChurnRetention.value || canResubscribe.value)

const hasActiveSubscription = computed(() => {
  const status = org.value?.subscription_status ?? 'none'
  return status === 'active' || status === 'trialing' || status === 'past_due'
})

const canResubscribe = computed(() =>
  !isOrgClosing.value
  && !hasActiveSubscription.value
  && Boolean(org.value?.stripe_customer_id?.trim() || isPaidPlan.value)
)

const canStartTeamTrial = computed(() =>
  canManageBilling.value
  && !isOrgClosing.value
  && normalizedPlan.value === 'free'
  && org.value?.trial_nudge_stage !== -1
  && org.value?.subscription_status !== 'trialing'
)

const trialLoading = ref(false)

const canManageBilling = computed(() => pageReady.value && isOrgAdmin(sessionUser.value))

const isAppliance = computed(() => {
  const mode = String(config.public.deploymentMode || '').toLowerCase()
  return mode === 'appliance' || mode === 'selfhost' || mode === 'community'
})

const commercialEnabled = computed(() => {
  const value = String(config.public.commercialEnabled ?? '').trim().toLowerCase()
  return value === 'true' || value === '1' || value === 'yes' || value === 'on'
})

const normalizedPlan = computed(() => normalizeOrganizationPlan(org.value?.plan))

const planOffering = computed(() => getPlanOffering(normalizedPlan.value))

const planLabel = computed(() => planOffering.value?.name ?? normalizedPlan.value)

const isPaidPlan = computed(() => isPaidCheckoutPlan(normalizedPlan.value))

const hasStripeCustomer = computed(() => Boolean(org.value?.stripe_customer_id?.trim()))

const isOrgClosing = computed(() => org.value?.status === 'closing')

const isChurnRetention = computed(() =>
  org.value?.status === 'active'
  && org.value?.subscription_status === 'canceled'
  && Boolean(org.value?.purge_scheduled_at?.trim())
)

const purgeScheduledLabel = computed(() => {
  const raw = org.value?.purge_scheduled_at?.trim()
  if (!raw) return null
  const date = new Date(raw)
  if (Number.isNaN(date.getTime())) return null
  return date.toLocaleDateString(undefined, { dateStyle: 'long' })
})

const currentPlanPriceLabel = computed(() => {
  if (subscription.value?.amountCents != null && subscription.value.currency) {
    const amount = subscription.value.amountCents / 100
    try {
      const formatted = new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: subscription.value.currency.toUpperCase(),
        maximumFractionDigits: 0
      }).format(amount)
      const interval = subscription.value.billingInterval === 'annual' ? '/yr' : '/mo'
      return `${formatted}${interval}`
    } catch {
      return `$${amount}${subscription.value.billingInterval === 'annual' ? '/yr' : '/mo'}`
    }
  }
  if (planOffering.value && isPaidPlan.value) {
    const interval = subscription.value?.billingInterval === 'annual' ? 'annual' : 'monthly'
    const price = formatPlanPrice(planOffering.value, interval)
    return `${price.priceLabel}${interval === 'annual' ? '/mo' : '/mo'}`
  }
  if (normalizedPlan.value === 'free') return 'Free'
  return ''
})

const planDescription = computed(() => planOffering.value?.description ?? '')

const renewalLabel = computed(() => {
  if (!subscription.value?.currentPeriodEnd) return null
  const end = new Date(subscription.value.currentPeriodEnd)
  if (Number.isNaN(end.getTime())) return null
  const dateLabel = end.toLocaleDateString(undefined, { dateStyle: 'long' })
  if (subscription.value.cancelAtPeriodEnd || stripeCancelPending.value) {
    return `Your subscription will end on ${dateLabel}.`
  }
  return `Your subscription will auto renew on ${dateLabel}.`
})

const usagePeriodLabel = computed(() => {
  if (!subscription.value) return null
  const start = new Date(subscription.value.currentPeriodStart)
  const end = new Date(subscription.value.currentPeriodEnd)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${fmt(start)} – ${fmt(end)}`
})

const showAnnualPromo = computed(() =>
  canChangePlan.value
  && annualCheckoutConfigured.value
  && isPaidPlan.value
  && subscription.value?.billingInterval === 'monthly'
  && !isOrgClosing.value
)

async function loadBillingSummary() {
  if (!pb?.authStore.token) return
  loading.value = true
  try {
    const summary = await $fetch<{
      organization: Organization
      usage: OrganizationPlanUsage
      usageRows: UsageBreakdownRow[]
      usageLimits: UsageLimitSummary
      planChanges: PlanChangeAssessment[]
      subscription: BillingSubscriptionSummary | null
      stripeCheckoutConfigured: boolean
      annualCheckoutConfigured: boolean
    }>('/api/billing/summary', {
      headers: { Authorization: `Bearer ${pb.authStore.token}` }
    })
    org.value = summary.organization
    usage.value = summary.usage
    usageRows.value = summary.usageRows
    usageLimits.value = summary.usageLimits
    planChanges.value = summary.planChanges
    subscription.value = summary.subscription
    billingSummaryStripeConfigured.value = summary.stripeCheckoutConfigured
    annualCheckoutConfigured.value = summary.annualCheckoutConfigured
  } catch (error) {
    toast.add({
      title: 'Could not load billing details',
      description: formatPbClientError(error),
      color: 'error'
    })
  } finally {
    loading.value = false
  }
}

async function loadInvoices() {
  if (!pb?.authStore.token || !hasStripeCustomer.value) {
    invoices.value = []
    return
  }
  invoicesLoading.value = true
  try {
    const result = await $fetch<{ invoices: BillingInvoiceSummary[] }>('/api/billing/invoices', {
      headers: { Authorization: `Bearer ${pb.authStore.token}` }
    })
    invoices.value = result.invoices
  } catch {
    invoices.value = []
  } finally {
    invoicesLoading.value = false
  }
}

function onOrganizationUpdated(updated: Organization) {
  org.value = updated
  void loadBillingSummary()
  void loadInvoices()
}

async function syncBillingFromStripe(): Promise<boolean> {
  if (!pb?.authStore.token) return false
  if (isOrgClosing.value) return false
  if (!org.value?.stripe_subscription_id?.trim() && !org.value?.stripe_customer_id?.trim()) {
    return false
  }

  syncLoading.value = true
  try {
    const result = await $fetch<{
      organization: Organization
      retentionStarted?: boolean
      emailsSent?: number
      emailError?: string
      cancelAtPeriodEnd?: boolean
    }>('/api/stripe/sync-billing-status', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pb.authStore.token}` }
    })
    org.value = result.organization
    const retentionStarted = Boolean(result.retentionStarted)
    stripeCancelPending.value = Boolean(
      result.cancelAtPeriodEnd && !isOrgClosing.value && !isChurnRetention.value
    )

    if (retentionStarted) {
      toast.add({
        title: 'Subscription canceled',
        description: 'Your account stays accessible for 30 days.',
        color: 'warning'
      })
      return true
    }

    if (stripeCancelPending.value) {
      toast.add({
        title: 'Cancellation detected',
        description: 'Stripe shows your subscription is scheduled to cancel.',
        color: 'warning'
      })
    }

    await loadBillingSummary()
    return false
  } catch (error) {
    toast.add({
      title: 'Could not refresh billing status',
      description: formatPbClientError(error),
      color: 'error'
    })
    return false
  } finally {
    syncLoading.value = false
  }
}

async function handlePortalReturnFlow() {
  if (portalReturnHandled.value) return
  portalReturnHandled.value = true
  await loadBillingSummary()
  const retentionStarted = await syncBillingFromStripe()
  await loadBillingSummary()
  await loadInvoices()
  showCheckoutResultToast(retentionStarted)
}

async function handleUpgradeReturnFlow() {
  if (upgradeReturnHandled.value) return
  upgradeReturnHandled.value = true

  for (let attempt = 0; attempt < 6; attempt++) {
    await loadBillingSummary()
    const upgraded = isPaidPlan.value || Boolean(org.value?.stripe_subscription_id?.trim())
    if (upgraded) {
      if (org.value?.stripe_customer_id?.trim() || org.value?.stripe_subscription_id?.trim()) {
        await syncBillingFromStripe()
      }
      break
    }
    if (attempt < 5) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }

  showCheckoutResultToast(false)
  await loadBillingSummary()
  await loadInvoices()
  await clearPortalQueryParams()
}

async function clearPortalQueryParams() {
  const nextQuery = { ...route.query }
  delete nextQuery.portal
  delete nextQuery.checkout
  await navigateTo({ path: route.path, query: nextQuery }, { replace: true })
}

async function openBillingPortal() {
  if (!pb?.authStore.token) return
  portalLoading.value = true
  try {
    const result = await $fetch<{ url: string }>('/api/stripe/create-portal-session', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pb.authStore.token}` }
    })
    if (result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer')
      toast.add({
        title: 'Stripe billing opened',
        description: 'When you finish updating billing, return here and refresh.',
        color: 'info'
      })
    }
  } catch (error) {
    toast.add({
      title: 'Could not open billing portal',
      description: formatPbClientError(error),
      color: 'error'
    })
  } finally {
    portalLoading.value = false
  }
}

function showCheckoutResultToast(retentionStarted = false) {
  const checkout = route.query.checkout
  const portal = route.query.portal
  if (retentionStarted || (portal === 'returned' && isChurnRetention.value)) {
    toast.add({
      title: 'Subscription canceled',
      description: purgeScheduledLabel.value
        ? `Your account remains accessible until ${purgeScheduledLabel.value}.`
        : 'Your account remains accessible during the 30-day retention period.',
      color: 'warning'
    })
  } else if (checkout === 'success') {
    toast.add({
      title: isPaidPlan.value ? 'Upgrade complete' : 'Payment received',
      description: isPaidPlan.value
        ? `Your organization is now on the ${planLabel.value} plan.`
        : 'Your plan may take a moment to update.',
      color: isPaidPlan.value ? 'success' : 'info'
    })
  } else if (checkout === 'cancelled') {
    toast.add({
      title: 'Checkout cancelled',
      description: 'No changes were made to your subscription.',
      color: 'neutral'
    })
  } else if (portal === 'returned') {
    toast.add({
      title: 'Billing updated',
      description: 'Your subscription changes may take a moment to appear.',
      color: 'success'
    })
  }
}

function openAdjustPlan() {
  adjustPlanOpen.value = true
  trackFunnelEvent('upgrade_click', {
    organizationId: org.value?.id,
    source: 'billing_adjust_plan'
  })
}

async function startTeamTrial() {
  if (!pb?.authStore.token || !canStartTeamTrial.value) return
  trialLoading.value = true
  try {
    const result = await $fetch<{ organization: Organization }>('/api/billing/start-trial', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pb.authStore.token}` }
    })
    org.value = result.organization
    trackFunnelEvent('trial_start', {
      organizationId: result.organization.id,
      source: 'billing'
    })
    toast.add({
      title: 'Team trial started',
      description: TEAM_TRIAL_CTA.subcopy,
      color: 'success'
    })
    await loadBillingSummary()
  } catch (error) {
    toast.add({
      title: 'Could not start trial',
      description: formatPbClientError(error),
      color: 'error'
    })
  } finally {
    trialLoading.value = false
  }
}

onMounted(async () => {
  await awaitAuthReady()
  syncAuth()
  pageReady.value = true
  if (!commercialEnabled.value) {
    loading.value = false
    return
  }
  if (isAppliance.value) {
    loading.value = false
    return
  }
  if (route.query.portal === 'returned') {
    await handlePortalReturnFlow()
    await clearPortalQueryParams()
    return
  }
  await loadBillingSummary()
  await loadInvoices()
  if (route.query.checkout === 'success') {
    await handleUpgradeReturnFlow()
    return
  }
  if (route.query.checkout === 'cancelled') {
    showCheckoutResultToast(false)
    await clearPortalQueryParams()
  }
})

watch(() => route.query.portal, async (portal) => {
  if (portal === 'returned' && pageReady.value) {
    await handlePortalReturnFlow()
    await clearPortalQueryParams()
  }
})
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Billing & Invoices" />
    </template>
    <template #body>
      <div
        v-if="!commercialEnabled"
        class="max-w-3xl space-y-4"
      >
        <UCard>
          <div class="space-y-2">
            <h2 class="text-base font-semibold text-highlighted">
              Self-hosted open source
            </h2>
            <p class="text-muted text-sm">
              This SiteNook instance runs without Stripe or Polar billing.
              Local limits are unlimited. To enable the commercial module, set
              <code class="text-xs">SITENOOK_COMMERCIAL=1</code>
              and configure Stripe or Polar — see
              <span class="font-medium text-default">docs/commercial.md</span>
              in the repository.
            </p>
          </div>
        </UCard>
      </div>

      <div
        v-else-if="isAppliance"
        class="max-w-3xl space-y-4"
      >
        <UCard v-if="!canManageBilling">
          <p class="text-muted text-sm">
            Only organization admins can manage the self-host licence.
          </p>
        </UCard>
        <ApplianceLicencePanel v-else />
      </div>

      <div v-else-if="!canManageBilling" class="space-y-4">
        <UCard>
          <p class="text-muted text-sm">
            Only organization admins can view billing settings.
          </p>
        </UCard>
      </div>

      <div
        v-else
        class="max-w-3xl"
      >
        <div
          v-if="loading"
          class="flex justify-center py-16"
        >
          <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin text-muted" />
        </div>

        <template v-else>
          <!-- Annual promo -->
          <div
            v-if="showAnnualPromo"
            class="mb-6 flex flex-col gap-3 rounded-lg border border-default bg-elevated/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-gift" class="mt-0.5 size-5 shrink-0 text-default" />
              <p class="text-sm text-default">
                Switch to annual billing and save on your subscription.
              </p>
            </div>
            <UButton
              size="sm"
              variant="outline"
              color="neutral"
              @click="openAdjustPlan"
            >
              Adjust plan
            </UButton>
          </div>

          <!-- Usage limit alerts -->
          <BillingUsageLimitAlert
            v-if="usageLimits && usageLimits.status === 'exceeded'"
            status="exceeded"
            :messages="usageLimits.messages"
            class="mb-6"
          />
          <BillingUsageLimitAlert
            v-else-if="usageLimits && usageLimits.status === 'warning'"
            status="warning"
            :messages="usageLimits.messages"
            class="mb-6"
          />

          <!-- Retention alerts -->
          <UAlert
            v-if="isOrgClosing"
            color="warning"
            variant="subtle"
            icon="i-lucide-triangle-alert"
            title="Organization closed"
            :description="purgeScheduledLabel
              ? `This organization is in 30-day retention until ${purgeScheduledLabel}.`
              : 'This organization is in 30-day retention.'"
            class="mb-6"
          />
          <UAlert
            v-else-if="isChurnRetention"
            color="warning"
            variant="subtle"
            icon="i-lucide-clock"
            title="Subscription canceled — 30-day retention"
            :description="purgeScheduledLabel
              ? `Your subscription has been canceled. Data is kept until ${purgeScheduledLabel}.`
              : 'Your subscription has been canceled. Your account remains accessible during retention.'"
            class="mb-6"
          />
          <UAlert
            v-else-if="stripeCancelPending"
            color="warning"
            variant="subtle"
            icon="i-lucide-clock"
            title="Subscription scheduled to cancel"
            description="Stripe shows this subscription is set to cancel at the end of the current period."
            class="mb-6"
          />

          <div class="rounded-xl border border-default bg-elevated/20 px-4 sm:px-6">
            <!-- Current plan -->
            <BillingSection title="Current plan">
              <template #meta>
                <p class="text-2xl font-semibold text-highlighted tabular-nums mt-2">
                  {{ planLabel }}
                  <span
                    v-if="currentPlanPriceLabel"
                    class="text-muted font-normal"
                  >
                    {{ currentPlanPriceLabel }}
                  </span>
                </p>
                <p
                  v-if="planDescription"
                  class="text-sm text-muted mt-2 max-w-xl leading-relaxed"
                >
                  {{ planDescription }}
                </p>
                <p
                  v-if="renewalLabel"
                  class="text-sm text-muted mt-2"
                >
                  {{ renewalLabel }}
                </p>
                <p
                  v-else-if="reinstateMode"
                  class="text-sm text-muted mt-2"
                >
                  Choose a plan to resubscribe and restore scheduled scans.
                </p>
              </template>
              <template
                v-if="canChangePlan || canStartTeamTrial"
                #action
              >
                <div class="flex flex-wrap gap-2">
                  <UButton
                    v-if="canStartTeamTrial"
                    size="sm"
                    :loading="trialLoading"
                    @click="startTeamTrial"
                  >
                    Start 30-day Team trial
                  </UButton>
                  <UButton
                    v-if="canChangePlan"
                    variant="outline"
                    color="neutral"
                    size="sm"
                    @click="openAdjustPlan"
                  >
                    Adjust plan
                  </UButton>
                </div>
              </template>
            </BillingSection>

            <!-- Payment -->
            <BillingSection
              v-if="!isOrgClosing"
              title="Payment"
              description="Update your payment details and billing information."
            >
              <template #action>
                <UButton
                  v-if="hasStripeCustomer"
                  variant="outline"
                  color="neutral"
                  size="sm"
                  :loading="portalLoading"
                  @click="openBillingPortal"
                >
                  Manage in Stripe
                </UButton>
                <UButton
                  v-else-if="canChangePlan"
                  size="sm"
                  @click="openAdjustPlan"
                >
                  Subscribe
                </UButton>
              </template>
            </BillingSection>

            <!-- Included usage -->
            <BillingSection title="Included usage">
              <BillingUsageBreakdownTable
                :rows="usageRows"
                :period-label="usagePeriodLabel"
              />
            </BillingSection>

            <!-- Invoices -->
            <BillingSection
              v-if="hasStripeCustomer"
              title="Invoices"
            >
              <BillingInvoicesTable
                :invoices="invoices"
                :loading="invoicesLoading"
              />
            </BillingSection>

            <!-- Cancel -->
            <BillingSection
              v-if="hasStripeCustomer && !isOrgClosing"
              title="Cancel"
              description="We'll be sad to see you go."
            >
              <template #action>
                <UButton
                  variant="outline"
                  color="neutral"
                  size="sm"
                  :loading="portalLoading"
                  @click="openBillingPortal"
                >
                  Cancel
                </UButton>
              </template>
            </BillingSection>
          </div>

          <div
            v-if="hasStripeCustomer && !isOrgClosing"
            class="mt-4 flex flex-wrap gap-2"
          >
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              icon="i-lucide-refresh-cw"
              :loading="syncLoading"
              @click="syncBillingFromStripe().then((started) => showCheckoutResultToast(started))"
            >
              Refresh billing status
            </UButton>
          </div>
        </template>

        <BillingAdjustPlanModal
          v-if="org"
          v-model:open="adjustPlanOpen"
          :organization="org"
          :usage="usage"
          :current-plan="normalizedPlan"
          :plan-changes="planChanges"
          :stripe-checkout-configured="stripeCheckoutConfigured"
          :annual-checkout-configured="annualCheckoutConfigured"
          :reinstate-mode="reinstateMode"
          @organization-updated="onOrganizationUpdated"
        />
      </div>
    </template>
  </AppDashboardPanel>
</template>
