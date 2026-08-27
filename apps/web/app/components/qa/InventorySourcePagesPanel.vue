<script setup lang="ts">
const props = defineProps<{
  assetUrl: string
  siteId: string
}>()

const { loadSourcePages, getSourcePages, isSourcePagesLoading } = useInventorySourcePages()

const pages = computed(() => {
  if (!props.siteId || !props.assetUrl) return []
  return getSourcePages(props.siteId, props.assetUrl)
})

const loading = computed(() => {
  if (!props.siteId || !props.assetUrl) return false
  return isSourcePagesLoading(props.siteId, props.assetUrl)
})

watch(
  () => [props.siteId, props.assetUrl] as const,
  ([siteId, assetUrl]) => {
    if (!siteId || !assetUrl) return
    void loadSourcePages(assetUrl, siteId)
  },
  { immediate: true }
)
</script>

<template>
  <QaInventorySourcePagesTable
    :pages="pages"
    :loading="loading"
  />
</template>
