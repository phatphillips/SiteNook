<script setup lang="ts">
import { parseBillingInterval, type BillingInterval } from '~/utils/stripeCheckout'
import { parseSelfServiceSignupFlag } from '~/utils/selfServiceSignup'

const config = useRuntimeConfig()
const route = useRoute()

const selfServiceEnabled = computed(() => parseSelfServiceSignupFlag(config.public.selfServiceSignup))
const selfhostConfigured = computed(() => {
  const flag = config.public.stripeSelfhostCheckoutConfigured
  return flag === true || flag === 'true' || flag === '1'
})
const supportEmail = computed(() =>
  String(config.public.supportEmail || 'contact@your-org.com').trim()
)

const billingInterval = ref<BillingInterval>('annual')
const checkoutLoading = ref(false)
const checkoutError = ref('')
const successBanner = computed(() => route.query.licence === 'success')

const composeSnippet = `# Community / Self-host appliance (data stays on your machine)
# 1. Copy deploy/community/.env.example → .env
# 2. Optional: set SITENOOK_LICENCE_KEY after purchase
# 3. docker compose up -d

git clone https://github.com/YOUR_ORG/sitenook-compose.git
cd sitenook-compose
cp .env.example .env
docker compose up -d`

async function startSelfHostCheckout() {
  checkoutError.value = ''
  if (!selfServiceEnabled.value || !selfhostConfigured.value) {
    checkoutError.value = `Self-host checkout is not enabled. Contact ${supportEmail.value}.`
    return
  }
  checkoutLoading.value = true
  try {
    const result = await $fetch<{ url: string }>('/api/stripe/create-selfhost-checkout-session', {
      method: 'POST',
      body: { interval: billingInterval.value }
    })
    if (!result.url) throw new Error('No checkout URL')
    await navigateTo(result.url, { external: true })
  } catch (error) {
    checkoutError.value = error instanceof Error ? error.message : 'Could not start checkout'
  } finally {
    checkoutLoading.value = false
  }
}

function chooseBillingInterval(next: BillingInterval) {
  billingInterval.value = parseBillingInterval(next)
}
</script>

<template>
  <div class="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
    <p class="text-sm font-medium text-primary">
      Self-host
    </p>
    <h1 class="mt-2 text-4xl font-semibold tracking-tight text-highlighted">
      Run SiteNook on your infrastructure
    </h1>
    <p class="mt-4 text-lg text-muted">
      Download the Community Docker stack for free (same limits as hosted Free: 1 site, 20 pages per scan).
      Activate a Self-host licence key to unlock Business-level local limits, updates, and email support.
      Your crawl data stays on your machine.
    </p>

    <UAlert
      v-if="successBanner"
      class="mt-8"
      color="success"
      variant="subtle"
      title="Payment received"
      description="Check your email for the Self-host licence key, then set SITENOOK_LICENCE_KEY in your appliance .env and restart."
    />

    <section class="mt-12 space-y-4">
      <h2 class="text-xl font-semibold text-highlighted">
        1. Install Community (free)
      </h2>
      <p class="text-muted">
        Requires Docker Compose. Typesense search is optional and pulled from the official upstream image — disabled by default.
      </p>
      <pre class="overflow-x-auto rounded-lg bg-muted/30 p-4 text-sm text-default"><code>{{ composeSnippet }}</code></pre>
      <p class="text-sm text-muted">
        Support for Community installs is docs-only. Paid Self-host includes email support at
        <a
          class="text-primary underline"
          :href="`mailto:${supportEmail}`"
        >{{ supportEmail }}</a>.
      </p>
    </section>

    <section class="mt-12 space-y-4">
      <h2 class="text-xl font-semibold text-highlighted">
        2. Unlock with a Self-host licence
      </h2>
      <p class="text-muted">
        Mirrors hosted Business limits locally (policies, inventory, PDF checks, higher site/page caps).
        Cancel anytime — Community Free caps remain if the key expires.
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <UButton
          :variant="billingInterval === 'monthly' ? 'solid' : 'outline'"
          size="sm"
          @click="chooseBillingInterval('monthly')"
        >
          Monthly
        </UButton>
        <UButton
          :variant="billingInterval === 'annual' ? 'solid' : 'outline'"
          size="sm"
          @click="chooseBillingInterval('annual')"
        >
          Annual
        </UButton>
        <UButton
          color="primary"
          :loading="checkoutLoading"
          :disabled="!selfhostConfigured"
          @click="startSelfHostCheckout"
        >
          Buy Self-host licence
        </UButton>
        <UButton
          to="/pricing"
          variant="ghost"
        >
          Prefer hosted cloud?
        </UButton>
      </div>

      <p
        v-if="checkoutError"
        class="text-sm text-error"
      >
        {{ checkoutError }}
      </p>
      <p
        v-if="!selfhostConfigured"
        class="text-sm text-muted"
      >
        Self-host Stripe prices are not configured on this deployment yet.
        Contact {{ supportEmail }} for a licence key.
      </p>
    </section>

    <section class="mt-12 space-y-2 text-sm text-muted">
      <h2 class="text-lg font-semibold text-highlighted">
        Licence env vars
      </h2>
      <pre class="overflow-x-auto rounded-lg bg-muted/30 p-4 text-sm text-default"><code>SITENOOK_DEPLOYMENT_MODE=appliance
SITENOOK_LICENCE_KEY=nook_…
SITENOOK_LICENCE_SERVER_URL=https://your-apex-host
SITENOOK_INSTANCE_DOMAIN=access.example.gov.au</code></pre>
    </section>
  </div>
</template>
