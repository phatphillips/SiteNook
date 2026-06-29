<script setup lang="ts">
definePageMeta({ layout: false })

const config = useRuntimeConfig()
const supportEmail = computed(() => config.public.supportEmail?.trim() || '')
</script>

<template>
  <AuthPageShell
    title="Organization closed"
    icon="i-lucide-building-2"
    subtitle="This organization is no longer active"
  >
    <div class="space-y-4 text-sm text-muted leading-relaxed">
      <p>
        An administrator closed this organization. Team members can no longer sign in or run scans.
      </p>
      <p>
        Your data is retained for 30 days after closure, then permanently deleted. If you need to
        recover access or export data before then, contact us as soon as possible.
      </p>
      <p v-if="supportEmail">
        Support:
        <a :href="`mailto:${supportEmail}`" class="text-primary hover:underline">{{ supportEmail }}</a>
      </p>
      <UButton to="/login" block variant="subtle" color="neutral">
        Back to sign in
      </UButton>
    </div>
  </AuthPageShell>
</template>
