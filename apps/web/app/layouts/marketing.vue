<script setup lang="ts">
import MarketingHeader from '~/components/marketing/MarketingHeader.vue'
import { MARKETING_NAV_GROUPS } from '~/utils/marketingHeaderNav'

const config = useRuntimeConfig()
const colorMode = useColorMode()

const supportEmail = computed(() => {
  const email = config.public.supportEmail
  return typeof email === 'string' && email.trim() ? email.trim() : ''
})

const footerResourceLinks = computed(() =>
  MARKETING_NAV_GROUPS.find(group => group.label === 'Resources')?.items ?? []
)

// Public marketing pages follow the visitor's system light/dark preference.
onMounted(() => {
  colorMode.preference = 'system'
})
</script>

<template>
  <div class="marketing-layout min-h-screen flex flex-col overflow-x-clip bg-default text-default">
    <MarketingHeader />

    <main id="marketing-main" class="flex-1">
      <slot />
    </main>

    <footer class="border-t border-default/60 py-8">
      <div class="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 text-sm text-muted sm:flex-row sm:items-start sm:justify-between sm:px-6">
        <p>&copy; {{ new Date().getFullYear() }} SiteNook</p>
        <div class="flex flex-col gap-4 sm:items-end">
          <div class="flex flex-wrap gap-x-4 gap-y-2 sm:justify-end">
            <NuxtLink
              v-for="link in footerResourceLinks"
              :key="link.to"
              :to="link.to"
              class="min-h-11 inline-flex items-center hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              {{ link.label }}
            </NuxtLink>
          </div>
          <div class="flex flex-wrap gap-x-4 gap-y-2 sm:justify-end">
            <NuxtLink
              to="/sign-in"
              class="min-h-11 inline-flex items-center hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Sign in
            </NuxtLink>
            <NuxtLink
              to="/signup"
              class="min-h-11 inline-flex items-center hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Sign up
            </NuxtLink>
            <a
              v-if="supportEmail"
              :href="`mailto:${supportEmail}`"
              class="min-h-11 inline-flex items-center hover:text-highlighted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>
