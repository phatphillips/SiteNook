<script setup lang="ts">
import type { PageRecord } from '~/types/sitenook'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const pageId = computed(() => route.params.pageId as string)
const { pb, awaitAuthReady, syncAuth } = usePocketBase()
const loading = ref(true)
const error = ref<string | null>(null)

provide('featurePageBannerLoading', loading)

onMounted(async () => {
  try {
    await awaitAuthReady()
    syncAuth()
    if (!pb) throw new Error('PocketBase client is not ready')

    const record = await pb.collection('pages').getOne(pageId.value, {
      fields: 'id,site'
    }) as unknown as PageRecord & { site?: string }

    const siteId = record.site
    if (siteId) {
      await navigateTo(`/sites/${siteId}/accessibility/simulator/${pageId.value}`, {
        replace: true
      })
      return
    }

    error.value = 'This page is not linked to a site.'
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e)
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <OrgFeaturePageShell title="Simulator">
    <div class="py-12 flex flex-col items-center gap-3 text-center">
      <UIcon
        v-if="loading"
        name="i-lucide-loader-circle"
        class="size-6 animate-spin text-muted"
      />
      <UAlert
        v-else-if="error"
        color="error"
        variant="subtle"
        :title="error"
        icon="i-lucide-alert-circle"
        class="max-w-lg"
      />
      <p v-else class="text-sm text-muted">
        Redirecting to the site simulator…
      </p>
      <UButton
        to="/accessibility/simulator"
        color="neutral"
        variant="outline"
        label="Back to Simulator"
      />
    </div>
  </OrgFeaturePageShell>
</template>
