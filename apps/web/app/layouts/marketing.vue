<script setup lang="ts">
const config = useRuntimeConfig()
</script>

<template>
  <div class="marketing-layout min-h-screen flex flex-col bg-default text-default">
    <header class="border-b border-default/60 bg-elevated/40 backdrop-blur-sm">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <NuxtLink to="/" class="flex items-center gap-2 font-semibold tracking-tight text-highlighted">
          <UIcon name="i-lucide-search-check" class="size-6 text-primary" />
          AccessIQ
        </NuxtLink>

        <nav class="flex items-center gap-2 sm:gap-4">
          <NuxtLink
            to="/sign-in"
            class="hidden text-sm text-muted hover:text-highlighted sm:inline"
          >
            Sign in
          </NuxtLink>
          <UButton to="/pricing" variant="ghost" color="neutral" size="sm">
            Pricing
          </UButton>
          <UButton to="/pricing" size="sm">
            Get started
          </UButton>
        </nav>
      </div>
    </header>

    <main class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default/60 py-8">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>&copy; {{ new Date().getFullYear() }} AccessIQ</p>
        <div class="flex flex-wrap gap-4">
          <NuxtLink to="/sign-in" class="hover:text-highlighted">
            Sign in
          </NuxtLink>
          <NuxtLink to="/signup" class="hover:text-highlighted">
            Sign up
          </NuxtLink>
          <a
            v-if="config.public.supportEmail"
            :href="`mailto:${config.public.supportEmail}`"
            class="hover:text-highlighted"
          >
            Contact
          </a>
        </div>
      </div>
    </footer>
  </div>
</template>
