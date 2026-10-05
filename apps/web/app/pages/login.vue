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

      <UAlert v-if="error" color="error" variant="subtle" :title="error" />

      <div class="flex flex-col gap-2.5 pt-1">
        <UButton type="submit" block size="lg" :loading="loading">
          Sign in
        </UButton>

        <UButton
          to="/forgot-password"
          block
          size="lg"
          color="neutral"
          variant="outline"
          :disabled="loading"
        >
          Forgot password?
        </UButton>

        <UButton
          to="/signup"
          block
          size="lg"
          color="neutral"
          variant="ghost"
          :disabled="loading"
        >
          Create account
        </UButton>
      </div>

      <p v-if="!isTenantHost" class="text-center text-sm text-muted">
        Wrong organization?
        <NuxtLink to="/sign-in" class="text-primary hover:underline">
          Use a different email
        </NuxtLink>
      </p>
    </form>
  </AuthPageShell>
</template>
