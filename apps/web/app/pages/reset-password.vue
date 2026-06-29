<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'guest' })

const route = useRoute()
const { confirmPasswordReset } = usePocketBase()
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const error = ref('')
const done = ref(false)
const loginUrl = ref('/login')

const token = computed(() => {
  const value = route.query.token
  return typeof value === 'string' ? value.trim() : ''
})

const isAccountSetup = computed(() => route.query.setup === '1')

const pageTitle = computed(() =>
  isAccountSetup.value ? 'Create your password' : 'Choose a new password'
)

const pageSubtitle = computed(() =>
  isAccountSetup.value
    ? 'Choose a password to finish setting up your account'
    : 'Set a new password for your account'
)

const passwordLabel = computed(() =>
  isAccountSetup.value ? 'Password' : 'New password'
)

const submitLabel = computed(() =>
  isAccountSetup.value ? 'Create password' : 'Update password'
)

const successTitle = computed(() =>
  isAccountSetup.value ? 'Account ready' : 'Password updated'
)

const successDescription = computed(() =>
  isAccountSetup.value
    ? 'Your password is set. You can now sign in.'
    : 'You can now sign in with your new password.'
)

async function submit() {
  error.value = ''

  if (!token.value) {
    error.value = isAccountSetup.value
      ? 'This setup link is invalid or incomplete. Ask your admin to resend the invite.'
      : 'This reset link is invalid or incomplete. Request a new link from the sign-in page.'
    return
  }

  if (password.value !== passwordConfirm.value) {
    error.value = 'Passwords do not match.'
    return
  }

  if (password.value.length < 8) {
    error.value = 'Password must be at least 8 characters.'
    return
  }

  loading.value = true
  try {
    await confirmPasswordReset(token.value, password.value)

    const resetEmail = decodePasswordResetTokenEmail(token.value)
    if (resetEmail) {
      try {
        const result = await $fetch<{ loginUrl: string }>('/api/org-login-url', {
          query: { email: resetEmail }
        })
        if (result.loginUrl) {
          loginUrl.value = result.loginUrl
        }
      } catch {
        loginUrl.value = '/login'
      }
    }

    done.value = true
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: string }).message)
      : 'Could not save password.'
    error.value = msg.includes('expired') || msg.includes('invalid')
      ? isAccountSetup.value
        ? 'This setup link has expired. Ask your admin to resend the invite.'
        : 'This reset link has expired. Request a new one from the sign-in page.'
      : isAccountSetup.value
        ? 'Could not set your password. Ask your admin to resend the invite.'
        : 'Could not reset password. Request a new link and try again.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthPageShell
    :title="pageTitle"
    :subtitle="pageSubtitle"
    icon="i-lucide-lock-keyhole"
  >
    <div v-if="done" class="space-y-5 text-center">
      <UAlert
        color="success"
        variant="subtle"
        :title="successTitle"
        :description="successDescription"
      />
      <UButton :to="loginUrl" block size="lg">
        Go to sign in
      </UButton>
    </div>

    <form v-else class="space-y-5" @submit.prevent="submit">
      <UAlert
        v-if="!token"
        color="warning"
        variant="subtle"
        title="Invalid link"
        :description="isAccountSetup
          ? 'Open the account setup link from your email, or ask your admin to resend the invite.'
          : 'Open the reset link from your email, or request a new one.'"
      />

      <UFormField :label="passwordLabel" class="w-full">
        <UInput
          v-model="password"
          class="w-full"
          type="password"
          required
          autocomplete="new-password"
          size="lg"
        />
      </UFormField>

      <UFormField label="Confirm password" class="w-full">
        <UInput
          v-model="passwordConfirm"
          class="w-full"
          type="password"
          required
          autocomplete="new-password"
          size="lg"
        />
      </UFormField>

      <UAlert v-if="error" color="error" variant="subtle" :title="error" />

      <UButton type="submit" block size="lg" :loading="loading" :disabled="!token">
        {{ submitLabel }}
      </UButton>

      <p v-if="!isAccountSetup" class="text-center text-sm text-muted">
        <NuxtLink to="/forgot-password" class="text-primary hover:underline">
          Request a new link
        </NuxtLink>
      </p>
    </form>
  </AuthPageShell>
</template>
