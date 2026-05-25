<script setup lang="ts">
const { sites, activeSite, activeSiteId } = useSites()

defineProps<{ collapsed?: boolean }>()

const items = computed(() => sites.value.map(site => ({
  label: site.name,
  description: site.url,
  onSelect() {
    activeSiteId.value = site.id
  }
})))
</script>

<template>
  <UDropdownMenu :items="[items]">
    <UButton
      color="neutral"
      variant="ghost"
      block
      :square="collapsed"
      :label="collapsed ? undefined : activeSite?.name || 'Select site'"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
    />
  </UDropdownMenu>
</template>
