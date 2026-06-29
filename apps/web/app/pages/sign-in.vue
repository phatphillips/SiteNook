<script setup lang="ts">
definePageMeta({ layout: false, middleware: ['guest', 'sign-in-hub'] })

import { parseSelfServiceSignupFlag } from '~/utils/selfServiceSignup'

const route = useRoute()
const config = useRuntimeConfig()

const email = ref('')
const loading = ref(false)
const error = ref('')

const selfServiceEnabled = computed(() => parseSelfServiceSignupFlag(config.public.selfServiceSignup))
const showUnknownHelp = computed(() => route.query.status === 'unknown')

onMounted(() => {
  const value = route.query.email
  if (typeof value === 'string' && value.trim()) {
    email.value = value.trim().toLowerCase()
  }
})

async function submit() {
  const trimmed = email.value.trim().toLowerCase()
  if (!trimmed) {
    error.value = 'Enter your work email to continue.'
    return
  }

  loading.value = true
  error.value = ''

  try {
    const minDelay = new Promise<void>(resolve => setTimeout(resolve, 600))
    const [result] = await Promise.all([
      $fetch<{ loginUrl: string }>('/api/org-login-url', { query: { email: trimmed } }),
      minDelay
    ])

    if (result.loginUrl) {
      window.location.assign(result.loginUrl)
      return
    }

    error.value = 'Could not look up your organization. Try again.'
  } catch (e: unknown) {
    error.value = readFetchErrorMessage(e, 'Could not look up your organization. Try again.')
  } finally {
    loading.value = false
  }
}

function readFetchErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'data' in err) {
    const data = (err as { data?: { statusMessage?: string, message?: string } }).data
    if (data?.statusMessage) return data.statusMessage
    if (data?.message) return data.message
  }
  if (err instanceof Error && err.message) {
    return err.message
  }
  return fallback
}
</script>

<template>
  <AuthPageShell
    title="Sign in"
    subtitle="Enter your work email and we will take you to your organization sign-in page."
    icon="i-lucide-log-in"
  >
    <div class="space-y-5">
      <UAlert
        v-if="showUnknownHelp"
        color="neutral"
        variant="subtle"
        title="Check your email or organization"
        description="If an account exists for that address, use the link your administrator shared. Otherwise create an organization or ask your team admin for an invite."
      />

      <form class="space-y-5" @submit.prevent="submit">
        <UFormField label="Work email" class="w-full">
          <UInput
            v-model="email"
            class="w-full"
            type="email"
            required
            autocomplete="email"
            placeholder="you@company.com"
            size="lg"
            :disabled="loading"
          />
        </UFormField>

        <UAlert v-if="error" color="error" variant="subtle" :title="error" />

        <UButton type="submit" block size="lg" :loading="loading">
          Continue
        </UButton>
      </form>

      <div class="space-y-3 text-center text-sm text-muted">
        <p v-if="selfServiceEnabled">
          New to AccessIQ?
          <NuxtLink to="/pricing" class="text-primary hover:underline">
            Create an organization
          </NuxtLink>
        </p>
        <p v-else>
          Need access?
          <NuxtLink to="/signup" class="text-primary hover:underline">
            Request access
          </NuxtLink>
        </p>
      </div>
    </div>
  </AuthPageShell>
</template>
