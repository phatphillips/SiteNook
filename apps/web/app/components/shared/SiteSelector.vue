<script setup lang="ts">
const props = withDefaults(
  defineProps<{
    /** Full-width control for sidebar (legacy). */
    collapsed?: boolean
    /** Labeled select menu matching the Search page site filter. */
    variant?: 'sidebar' | 'navbar'
    /** Field label shown above the control (navbar variant). */
    label?: string
  }>(),
  {
    variant: 'sidebar',
    label: 'Site'
  }
)

const { sites, activeSiteId, fetchSites } = useSites()
const route = useRoute()

const isNavbar = computed(() => props.variant === 'navbar')

watch(
  () => route.params.id,
  (id) => {
    if (typeof id === 'string' && id) {
      activeSiteId.value = id
    }
  },
  { immediate: true }
)

onMounted(() => {
  fetchSites().catch(() => {})
})

const siteOptions = computed(() =>
  sites.value.map(site => ({ label: site.name, value: site.id }))
)

const activeSiteName = computed(() =>
  sites.value.find(site => site.id === activeSiteId.value)?.name ?? 'Select site'
)

const selectedSiteId = computed({
  get() {
    return activeSiteId.value ?? ''
  },
  set(siteId: string) {
    if (!siteId || siteId === activeSiteId.value) return
    activeSiteId.value = siteId
    const siteRoute = route.path.match(/^\/sites\/[^/]+(\/.*)?$/)
    if (siteRoute) {
      navigateTo(`/sites/${siteId}${siteRoute[1] || ''}`)
    }
  }
})

const dropdownItems = computed(() => sites.value.map(site => ({
  label: site.name,
  description: site.url,
  onSelect() {
    selectedSiteId.value = site.id
  }
})))
</script>

<template>
  <UFormField
    v-if="isNavbar"
    :label="label"
    class="min-w-44 shrink-0"
  >
    <USelectMenu
      v-model="selectedSiteId"
      :items="siteOptions"
      value-key="value"
      size="sm"
      placeholder="Select site…"
      class="w-full"
    />
  </UFormField>

  <UDropdownMenu
    v-else
    :items="[dropdownItems]"
  >
    <UButton
      color="neutral"
      variant="ghost"
      :block="!collapsed"
      :square="collapsed"
      :label="collapsed ? undefined : activeSiteName"
      :trailing-icon="collapsed ? undefined : 'i-lucide-chevrons-up-down'"
    />
  </UDropdownMenu>
</template>
