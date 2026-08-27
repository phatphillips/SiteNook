<script setup lang="ts">
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const { subdomain } = useTenantOrg()

const apexUrl = computed(() => {
  const appUrl = config.public.appUrl?.trim() || '/'
  try {
    const url = new URL(appUrl)
    return `${url.protocol}//${url.host}/`
  } catch {
    return '/'
  }
})
</script>

<template>
  <AuthPageShell
    title="Account not found"
    :subtitle="subdomain ? `We could not find an organization for “${subdomain}”.` : 'This organization URL is not recognized.'"
  >
    <div class="space-y-4 text-sm text-muted">
      <p>
        Check the link you were given, or ask your administrator for the correct sign-in URL
        (it usually looks like <span class="font-mono text-default">your-agency.sitenook.com</span>).
      </p>
      <UButton :to="apexUrl" block size="lg" variant="soft">
        Go to main site
      </UButton>
    </div>
  </AuthPageShell>
</template>
