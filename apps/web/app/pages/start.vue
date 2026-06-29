<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'guest' })

import type { OrganizationPlan } from '~/types/accessiq'
import { parseSelfServiceSignupFlag } from '~/utils/selfServiceSignup'
import { formatPlanLabel } from '~/utils/planPricing'

interface StartAccessResponse {
  allowed: boolean
  plan?: OrganizationPlan
  checkoutSessionId?: string
  customerEmail?: string
  devBypass?: boolean
  redirectTo?: string
  message?: string
}

const route = useRoute()
const config = useRuntimeConfig()
const { ready, isApexHost, loadTenantContext } = useTenantOrg()

const selfServiceEnabled = computed(() => parseSelfServiceSignupFlag(config.public.selfServiceSignup))
const canUseWizard = computed(() => selfServiceEnabled.value && isApexHost.value)
const checkingAccess = ref(true)
const access = ref<StartAccessResponse | null>(null)

const planLabel = computed(() => formatPlanLabel(access.value?.plan))

onMounted(async () => {
  if (!ready.value) {
    try {
      await loadTenantContext()
    } catch {
      // tenant context unavailable — treat as non-apex
    }
  }

  if (!canUseWizard.value) {
    checkingAccess.value = false
    await navigateTo('/signup', { replace: true })
    return
  }

  try {
    const response = await $fetch<StartAccessResponse>('/api/start-access', {
      query: {
        plan: route.query.plan,
        checkout: route.query.checkout
      }
    })
    access.value = response

    if (!response.allowed) {
      await navigateTo(response.redirectTo || '/pricing', { replace: true })
    }
  } catch {
    await navigateTo('/pricing', { replace: true })
  } finally {
    checkingAccess.value = false
  }
})
</script>

<template>
  <AuthPageShell
    title="Create your organization"
    :subtitle="access?.allowed
      ? `Set up AccessIQ for your team (${planLabel} plan).`
      : 'Set up AccessIQ for your team in a few steps.'"
    icon="i-lucide-building-2"
  >
    <div v-if="checkingAccess" class="flex justify-center py-8">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>
    <CreateOrganizationWizard
      v-else-if="access?.allowed"
      :app-domain="config.public.appDomain"
      :app-url="config.public.appUrl"
      :terms-url="config.public.termsUrl || undefined"
      :turnstile-site-key="config.public.turnstileSiteKey || undefined"
      :plan="access.plan"
      :checkout-session-id="access.checkoutSessionId || (access.devBypass ? 'dev_bypass' : undefined)"
      :initial-owner-email="access.customerEmail"
    />
  </AuthPageShell>
</template>
