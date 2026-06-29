<script setup lang="ts">
definePageMeta({ layout: false, middleware: 'guest' })

const { requestPasswordReset } = usePocketBase()
const email = ref('')
const loading = ref(false)
const error = ref('')
const sent = ref(false)

async function submit() {
  loading.value = true
  error.value = ''
  sent.value = false
  try {
    await requestPasswordReset(email.value)
    sent.value = true
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: string }).message)
      : 'Could not send reset email.'
    if (msg.toLowerCase().includes('smtp') || msg.toLowerCase().includes('mail')) {
      error.value = 'Email is not configured on the server. Ask an administrator to set up SMTP in PocketBase.'
    } else {
      error.value = 'If an account exists for that email, a reset link will be sent. Check your inbox or try again later.'
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthPageShell
    title="Reset password"
    subtitle="We will email you a link to choose a new password"
    icon="i-lucide-key-round"
  >
    <form v-if="!sent" class="space-y-5" @submit.prevent="submit">
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

      <UAlert v-if="error" color="error" variant="subtle" :title="error" />

      <UButton type="submit" block size="lg" :loading="loading">
        Send reset link
      </UButton>

      <p class="text-center text-sm text-muted">
        <NuxtLink to="/login" class="text-primary hover:underline">
          Back to sign in
        </NuxtLink>
      </p>
    </form>

    <div v-else class="space-y-5 text-center">
      <UAlert
        color="success"
        variant="subtle"
        title="Check your email"
        description="If an account exists for that address, you will receive a password reset link shortly."
      />
      <NuxtLink to="/login" class="text-sm text-primary hover:underline">
        Return to sign in
      </NuxtLink>
    </div>
  </AuthPageShell>
</template>
