<script setup lang="ts">
const props = defineProps<{
  supportEmail: string
}>()

const emit = defineEmits<{
  contactClick: []
}>()

const mailtoHref = computed(() => {
  const email = props.supportEmail.trim() || 'contact@your-org.com'
  const subject = encodeURIComponent('SiteNook invoice / purchase order')
  return `mailto:${email}?subject=${subject}`
})
</script>

<template>
  <aside
    class="rounded-xl border border-default/80 bg-elevated/40 px-5 py-5 text-center sm:px-8"
    aria-labelledby="pricing-invoice-heading"
  >
    <h2
      id="pricing-invoice-heading"
      class="text-base font-semibold text-highlighted"
    >
      Paying by invoice or purchase order
    </h2>
    <p class="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-muted">
      If your finance team needs a purchase order, invoice, or wire transfer — common for education and government buyers — email
      <a
        :href="mailtoHref"
        class="font-medium text-highlighted underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-default"
        @click="emit('contactClick')"
      >{{ supportEmail }}</a>
      and we will help with Business upgrades or Enterprise (SSO/SAML, self-hosted deployment, and SLA).
    </p>
  </aside>
</template>
