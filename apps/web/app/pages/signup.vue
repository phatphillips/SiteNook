<script setup lang="ts">
definePageMeta({ layout: false, middleware: [] })

const { signup } = usePocketBase()
const name = ref('')
const email = ref('')
const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const error = ref('')

async function submit() {
  error.value = ''

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
    await signup(name.value, email.value, password.value)
    await navigateTo('/', { replace: true })
  } catch (e: unknown) {
    const status = e && typeof e === 'object' && 'status' in e ? Number((e as { status: number }).status) : 0
    const msg = e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Could not create account.'
    if (status === 400 && msg.includes('validation')) {
      error.value = 'An account with this email may already exist.'
    } else if (status === 400 || status === 401) {
      error.value = 'Could not create account. Check your details and try again.'
    } else {
      error.value = msg
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-elevated/30 p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <p class="text-center">
          <UIcon name="i-lucide-search-check" class="size-10 text-primary mx-auto mb-2" />
        </p>
        <div class="text-center">
          <h1 class="text-2xl font-bold">Create account</h1>
          <p class="text-sm text-muted mt-1">Get started with AccessIQ</p>
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Name" required>
          <UInput v-model="name" required autocomplete="name" />
        </UFormField>
        <UFormField label="Email" required>
          <UInput v-model="email" type="email" required autocomplete="email" />
        </UFormField>
        <UFormField label="Password" required>
          <UInput v-model="password" type="password" required autocomplete="new-password" />
        </UFormField>
        <UFormField label="Confirm password" required>
          <UInput v-model="passwordConfirm" type="password" required autocomplete="new-password" />
        </UFormField>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
        <UButton type="submit" block :loading="loading">Create account</UButton>
        <p class="text-center text-sm text-muted">
          Have an account?
          <NuxtLink to="/login" class="text-primary hover:underline">Log in</NuxtLink>
        </p>
      </form>
    </UCard>
  </div>
</template>
