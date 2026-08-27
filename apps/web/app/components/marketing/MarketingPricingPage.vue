<script setup lang="ts">
import MarketingFaqSection from '~/components/marketing/MarketingFaqSection.vue'
import PricingComparisonTable from '~/components/marketing/PricingComparisonTable.vue'
import PricingInvoiceCallout from '~/components/marketing/PricingInvoiceCallout.vue'
import PricingPlanCard from '~/components/marketing/PricingPlanCard.vue'
import { trackFunnelEvent } from '~/utils/funnelAnalytics'
import { PRICING_FAQ_ITEMS } from '~/utils/marketingFaq'
import type { BillingInterval } from '~/utils/planPricing'
import {
  buildFreePlanStartUrl,
  buildTeamTrialStartUrl,
  FREE_PLAN_FOOTNOTE,
  getTypicalAnnualSavingsPercent,
  MARKETING_PLAN_CARDS,
  resolvePlanCta,
  resolveTeamSubscribeCta,
  TEAM_TRIAL_CTA
} from '~/utils/planPricing'
import { parseSelfServiceSignupFlag } from '~/utils/selfServiceSignup'
import type { PaidCheckoutPlan } from '~/utils/planLimits'
import {
  parseStripeAnnualCheckoutConfiguredFlag,
  parseStripeCheckoutConfiguredFlag,
  parseStripeDevBypassFlag,
  shouldAllowDevCheckoutBypass
} from '~/utils/stripeCheckout'

const config = useRuntimeConfig()

const billingInterval = ref<BillingInterval>('annual')
const annualSavingsPercent = getTypicalAnnualSavingsPercent()

const selfServiceEnabled = computed(() => parseSelfServiceSignupFlag(config.public.selfServiceSignup))
const supportEmail = computed(() => config.public.supportEmail || 'contact@your-org.com')
const stripeCheckoutConfigured = computed(() =>
  parseStripeCheckoutConfiguredFlag(config.public.stripeCheckoutConfigured)
)
const annualCheckoutConfigured = computed(() =>
  parseStripeAnnualCheckoutConfiguredFlag(config.public.stripeAnnualCheckoutConfigured)
)
const devBypassEnabled = computed(() =>
  shouldAllowDevCheckoutBypass({
    isDev: import.meta.dev,
    devBypassFlag: parseStripeDevBypassFlag(config.public.stripeDevBypass),
    appDomain: config.public.appDomain
  })
)

watch(
  annualCheckoutConfigured,
  (enabled) => {
    if (!enabled && billingInterval.value === 'annual') {
      billingInterval.value = 'monthly'
    }
  },
  { immediate: true }
)

const annualToggleEnabled = computed(() => annualCheckoutConfigured.value)

const ctaOptions = computed(() => ({
  selfServiceEnabled: selfServiceEnabled.value,
  supportEmail: supportEmail.value,
  stripeCheckoutConfigured: stripeCheckoutConfigured.value,
  devBypassEnabled: devBypassEnabled.value,
  billingInterval: billingInterval.value,
  annualCheckoutConfigured: annualCheckoutConfigured.value
}))

const planCards = computed(() => MARKETING_PLAN_CARDS.map(plan => ({
  plan,
  cta: resolvePlanCta(plan.id, ctaOptions.value),
  secondaryCta: plan.id === 'team' ? resolveTeamSubscribeCta(ctaOptions.value) : null
})))

const freeStartHref = computed(() => {
  if (selfServiceEnabled.value) return buildFreePlanStartUrl()
  return '/signup'
})

const trialHref = computed(() => {
  if (selfServiceEnabled.value) return buildTeamTrialStartUrl()
  return '/signup'
})

const enterpriseMailto = computed(() => {
  const email = supportEmail.value.trim() || 'contact@your-org.com'
  return `mailto:${email}?subject=${encodeURIComponent('SiteNook Enterprise plan')}`
})

const checkoutLoadingPlan = ref<PaidCheckoutPlan | null>(null)
const checkoutError = ref('')

function setBillingInterval(next: BillingInterval) {
  if (next === 'annual' && !annualToggleEnabled.value) return
  if (billingInterval.value === next) return
  billingInterval.value = next
  trackFunnelEvent('pricing_interval_toggle', { interval: next })
}

async function startCheckout(plan: PaidCheckoutPlan, interval: BillingInterval) {
  checkoutLoadingPlan.value = plan
  checkoutError.value = ''
  try {
    const result = await $fetch<{ url: string }>('/api/stripe/create-checkout-session', {
      method: 'POST',
      body: { plan, interval }
    })
    if (result.url) {
      window.location.assign(result.url)
      return
    }
    checkoutError.value = 'Stripe did not return a checkout URL.'
  } catch (error: unknown) {
    checkoutError.value = readFetchErrorMessage(error, 'Could not start checkout. Please try again.')
  } finally {
    checkoutLoadingPlan.value = null
  }
}

function onPlanCtaClick(planId: string, label: string) {
  trackFunnelEvent('pricing_cta_click', {
    plan: planId,
    label,
    interval: billingInterval.value
  })
}

function onInvoiceClick() {
  trackFunnelEvent('pricing_invoice_click', {})
}

function onClosingCta(kind: 'trial' | 'free' | 'enterprise') {
  trackFunnelEvent('pricing_closing_cta_click', { kind })
}

function readFetchErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object' && 'data' in error) {
    const data = (error as { data?: { statusMessage?: string, message?: string } }).data
    if (data?.statusMessage) return data.statusMessage
    if (data?.message) return data.message
  }
  if (error instanceof Error && error.message) {
    return error.message
  }
  return fallback
}
</script>

<template>
  <div>
    <a
      href="#pricing-main"
      class="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-elevated focus:px-4 focus:py-3 focus:text-sm focus:font-medium focus:text-highlighted focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-primary"
    >
      Skip to pricing plans
    </a>

    <section class="border-b border-default/60">
      <div class="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 sm:py-20">
        <p class="mb-4 text-sm font-medium text-muted">
          Hosted cloud accessibility &amp; QA monitoring
        </p>
        <h1 class="text-4xl font-semibold tracking-tight text-highlighted sm:text-5xl">
          Choose the plan that fits how many sites you care for
        </h1>
        <p class="mt-6 text-lg leading-relaxed text-muted">
          Start with a 30-day Team trial — no credit card — or subscribe when you are ready.
          Annual billing saves about {{ annualSavingsPercent }}%. Free remains available with 1 site and 20 pages per scan.
        </p>
        <p class="mt-4 text-sm text-muted">
          {{ TEAM_TRIAL_CTA.subcopy }}
        </p>
      </div>
    </section>

    <div id="pricing-main" tabindex="-1">
      <section class="bg-elevated/20" aria-labelledby="pricing-plans-heading">
        <div class="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="pricing-plans-heading" class="sr-only">
            Pricing plans
          </h2>

          <div class="mb-10 flex flex-col items-center gap-4">
            <div
              class="inline-flex items-center gap-1 rounded-xl border border-default bg-elevated/50 p-1"
              role="group"
              aria-label="Billing period"
            >
              <button
                type="button"
                class="min-h-11 min-w-11 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default"
                :class="billingInterval === 'monthly'
                  ? 'bg-[var(--color-action-solid)] text-[var(--color-action-solid-text)] shadow-sm'
                  : 'text-muted hover:text-highlighted'"
                :aria-pressed="billingInterval === 'monthly'"
                @click="setBillingInterval('monthly')"
              >
                Monthly
              </button>
              <button
                type="button"
                class="min-h-11 min-w-11 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default disabled:cursor-not-allowed disabled:opacity-50"
                :class="billingInterval === 'annual'
                  ? 'bg-[var(--color-action-solid)] text-[var(--color-action-solid-text)] shadow-sm'
                  : 'text-muted hover:text-highlighted'"
                :aria-pressed="billingInterval === 'annual'"
                :disabled="!annualToggleEnabled"
                :title="annualToggleEnabled ? undefined : 'Annual billing will be available once annual Stripe prices are configured.'"
                @click="setBillingInterval('annual')"
              >
                Annual
                <span class="ms-1 text-xs opacity-90">(save {{ annualSavingsPercent }}%)</span>
              </button>
            </div>
            <p class="text-center text-sm text-muted">
              All listed plans run on SiteNook hosted cloud. Enterprise includes optional self-hosted deployment.
            </p>
          </div>

          <div class="grid gap-6 min-[820px]:grid-cols-3">
            <PricingPlanCard
              v-for="{ plan, cta, secondaryCta } in planCards"
              :key="plan.id"
              :plan="plan"
              :interval="billingInterval"
              :cta="cta"
              :secondary-cta="secondaryCta"
              :checkout-loading-plan="checkoutLoadingPlan"
              @checkout="startCheckout"
              @cta-click="onPlanCtaClick"
            />
          </div>

          <div class="mt-10">
            <PricingInvoiceCallout
              :support-email="supportEmail"
              @contact-click="onInvoiceClick"
            />
          </div>

          <div class="mt-8 rounded-xl border border-default/80 bg-elevated/30 px-5 py-4 text-center sm:px-6">
            <p class="text-sm text-muted">
              <span class="font-medium text-default">{{ FREE_PLAN_FOOTNOTE.headline }}</span>
              {{ ' ' }}{{ FREE_PLAN_FOOTNOTE.body }}
              <NuxtLink
                :to="freeStartHref"
                class="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                @click="onClosingCta('free')"
              >
                {{ FREE_PLAN_FOOTNOTE.ctaLabel }} &rarr;
              </NuxtLink>
            </p>
          </div>

          <p v-if="checkoutError" class="mt-6 text-center text-sm text-error" role="alert">
            {{ checkoutError }}
          </p>
        </div>
      </section>

      <PricingComparisonTable />

      <MarketingFaqSection
        title="Frequently asked questions"
        description="Trial terms, purchase orders, plan limits, privacy, and how SiteNook compares to enterprise suites."
        :items="PRICING_FAQ_ITEMS"
      />

      <section
        class="border-t border-default/60 bg-elevated/30"
        aria-labelledby="pricing-closing-heading"
      >
        <div class="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6">
          <h2
            id="pricing-closing-heading"
            class="text-2xl font-semibold tracking-tight text-highlighted sm:text-3xl"
          >
            Inclusion is not a one-off audit. It is ongoing care for every visitor.
          </h2>
          <p class="mt-4 text-muted">
            Start monitoring accessibility, QA, and SEO on the sites you already manage — then invite the people who fix the findings.
          </p>
          <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
            <UButton
              :to="trialHref"
              size="lg"
              class="min-h-11"
              @click="onClosingCta('trial')"
            >
              Start 30-day Team trial
            </UButton>
            <UButton
              :href="enterpriseMailto"
              size="lg"
              variant="soft"
              color="neutral"
              class="min-h-11"
              @click="onClosingCta('enterprise')"
            >
              Contact sales
            </UButton>
          </div>
          <p class="mt-6 text-sm text-muted">
            Prefer to keep data on your own servers?
            <NuxtLink
              to="/download"
              class="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Download Community / buy Self-host
            </NuxtLink>
          </p>
          <p class="mt-6 text-sm text-muted">
            Already part of a team?
            <NuxtLink
              to="/sign-in"
              class="text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Sign in
            </NuxtLink>
          </p>
        </div>
      </section>
    </div>
  </div>
</template>
