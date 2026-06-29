<script setup lang="ts">
import PricingPlanCard from '~/components/marketing/PricingPlanCard.vue'
import type { BillingInterval } from '~/utils/planPricing'
import {
  buildFreePlanStartUrl,
  FREE_PLAN_FOOTNOTE,
  PAID_PLAN_OFFERINGS,
  resolvePlanCta
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

const billingInterval = ref<BillingInterval>('monthly')

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

const annualToggleEnabled = computed(() => annualCheckoutConfigured.value)

const planCards = computed(() => PAID_PLAN_OFFERINGS.map((plan) => ({
  plan,
  cta: resolvePlanCta(plan.id, {
    selfServiceEnabled: selfServiceEnabled.value,
    supportEmail: supportEmail.value,
    stripeCheckoutConfigured: stripeCheckoutConfigured.value,
    devBypassEnabled: devBypassEnabled.value,
    billingInterval: billingInterval.value,
    annualCheckoutConfigured: annualCheckoutConfigured.value
  })
})))

const freeStartHref = computed(() => {
  if (selfServiceEnabled.value) return buildFreePlanStartUrl()
  return '/signup'
})

const checkoutLoadingPlan = ref<PaidCheckoutPlan | null>(null)
const checkoutError = ref('')

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
    <section class="border-b border-default/60">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div class="max-w-3xl">
          <p class="mb-4 text-sm font-medium text-primary">
            Hosted cloud accessibility &amp; QA monitoring
          </p>
          <h1 class="text-4xl font-semibold tracking-tight text-highlighted sm:text-5xl">
            Monitor accessibility, QA, and SEO across every site you ship
          </h1>
          <p class="mt-6 text-lg leading-relaxed text-muted">
            Choose a plan based on how many sites you monitor and how deep each crawl goes.
            Every tier maps to your organization&rsquo;s
            <code class="rounded bg-elevated px-1.5 py-0.5 text-sm text-default">plan</code>
            setting in AccessIQ.
          </p>
        </div>
      </div>
    </section>

    <section class="bg-elevated/20">
      <div class="mx-auto max-w-7xl px-4 py-16 sm:px-6">
        <div class="mb-10 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p class="text-sm text-muted">
            All plans run on AccessIQ hosted cloud. Enterprise includes optional self-hosted deployment.
          </p>
          <div class="flex items-center gap-3 rounded-lg border border-default bg-elevated/40 p-1">
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
              :title="annualToggleEnabled ? undefined : 'Annual billing will be available once annual Stripe prices are configured.'"
              @click="billingInterval = 'annual'"
            >
              Annually
              <span class="text-xs opacity-80">(Save ~15%)</span>
            </button>
          </div>
        </div>

        <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <PricingPlanCard
            v-for="{ plan, cta } in planCards"
            :key="plan.id"
            :plan="plan"
            :interval="billingInterval"
            :cta="cta"
            :checkout-loading-plan="checkoutLoadingPlan"
            @checkout="startCheckout"
          />
        </div>

        <div class="mt-10 rounded-xl border border-default/80 bg-elevated/30 px-5 py-4 text-center sm:px-6">
          <p class="text-sm text-muted">
            <span class="font-medium text-default">{{ FREE_PLAN_FOOTNOTE.headline }}</span>
            {{ ' ' }}{{ FREE_PLAN_FOOTNOTE.body }}
            <NuxtLink :to="freeStartHref" class="text-primary hover:underline">
              {{ FREE_PLAN_FOOTNOTE.ctaLabel }} &rarr;
            </NuxtLink>
          </p>
        </div>
      </div>
    </section>

    <section class="border-t border-default/60 bg-elevated/20">
      <div class="mx-auto max-w-7xl px-4 py-12 text-center sm:px-6">
        <p v-if="checkoutError" class="mb-4 text-sm text-error">
          {{ checkoutError }}
        </p>
        <p class="text-sm text-muted">
          Already part of a team?
          <NuxtLink to="/sign-in" class="text-primary hover:underline">
            Sign in
          </NuxtLink>
        </p>
      </div>
    </section>
  </div>
</template>
