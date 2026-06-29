<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'guest' })

import { resolveLoginRedirectPath } from '~/utils/pbAuth'

const route = useRoute()
const { login, syncAuth, getAuthErrorMessage } = usePocketBase()
const { organization, isTenantHost } = useTenantOrg()
const email = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

onMounted(() => {
  const value = route.query.email
  if (typeof value === 'string' && value.trim()) {
    email.value = value.trim().toLowerCase()
  }

  if (route.query.error === 'wrong-org') {
    error.value = 'This account belongs to a different organization. Use your organization sign-in URL.'
  }

  if (route.query.error === 'org-closed') {
    error.value = 'This organization has been closed. Contact support if you need help.'
  }
})

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await login(email.value.trim(), password.value)
    syncAuth()
    await navigateTo(resolveLoginRedirectPath(route.query.redirect), { replace: true })
  } catch (e: unknown) {
    error.value = getAuthErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthPageShell
    title="AccessIQ"
    icon="i-lucide-log-in"
    :subtitle="isTenantHost && organization ? `Sign in to ${organization.name}` : 'Sign in to your account'"
  >
    <form class="space-y-5" @submit.prevent="submit">
      <UFormField label="Email" class="w-full">
        <UInput
          v-model="email"
          class="w-full"
          type="email"
          required
          autocomplete="email"
          placeholder="you@company.com"
          size="lg"
        />
      </UFormField>

      <UFormField label="Password" class="w-full">
        <UInput
          v-model="password"
          class="w-full"
          type="password"
          required
          autocomplete="current-password"
          placeholder="Enter your password"
          size="lg"
        />
      </UFormField>

      <p class="text-right text-sm">
        <NuxtLink to="/forgot-password" class="text-primary hover:underline">
          Forgot password?
        </NuxtLink>
      </p>

      <UAlert v-if="error" color="error" variant="subtle" :title="error" />

      <UButton type="submit" block size="lg" :loading="loading">
        Sign in
      </UButton>

      <p class="text-center text-sm text-muted">
        Need an account?
        <NuxtLink to="/signup" class="text-primary hover:underline">
          Request access
        </NuxtLink>
        <template v-if="!isTenantHost">
          ·
          <NuxtLink to="/sign-in" class="text-primary hover:underline">
            Use a different email
          </NuxtLink>
        </template>
      </p>
    </form>
  </AuthPageShell>
</template>
