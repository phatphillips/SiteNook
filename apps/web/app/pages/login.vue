<script setup lang="ts">
definePageMeta({ layout: false, middleware: [] })

const { login, restoreAuth, isAuthenticated, getAuthErrorMessage } = usePocketBase()
const email = ref('')
const password = ref('')
const remember = ref(true)
const loading = ref(false)
const error = ref('')

onMounted(() => {
  restoreAuth()
  if (isAuthenticated.value) {
    navigateTo('/', { replace: true })
  }
})

async function submit() {
  loading.value = true
  error.value = ''
  try {
    await login(email.value.trim(), password.value)
    await navigateTo('/', { replace: true })
  } catch (e: unknown) {
    error.value = getAuthErrorMessage(e)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-elevated/30 p-4">
    <UCard class="w-full max-w-md">
      <template #header>
        <div class="text-center">
          <UIcon name="i-lucide-search-check" class="size-10 text-primary mx-auto mb-2" />
          <h1 class="text-2xl font-bold">AccessIQ</h1>
          <p class="text-sm text-muted mt-1">Sign in to your account</p>
        </div>
      </template>

      <form class="space-y-4" @submit.prevent="submit">
        <UFormField label="Email">
          <UInput v-model="email" type="email" required autocomplete="email" />
        </UFormField>
        <UFormField label="Password">
          <UInput v-model="password" type="password" required autocomplete="current-password" />
        </UFormField>
        <UCheckbox v-model="remember" label="Remember me" />
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
        <UButton type="submit" block :loading="loading">Sign in</UButton>
        <p class="text-center text-sm text-muted">
          No account?
          <NuxtLink to="/signup" class="text-primary hover:underline">Sign up</NuxtLink>
        </p>
      </form>
    </UCard>
  </div>
</template>
