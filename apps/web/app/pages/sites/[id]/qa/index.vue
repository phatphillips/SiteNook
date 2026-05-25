<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { brokenLinkCount, misspellingCount, avgReadability, latestScan } = useQA(siteId)
const { pb } = usePocketBase()
const policyCount = ref(0)

onMounted(async () => {
  try {
    const policies = await pb.collection('policy_matches').getFullList({
      filter: latestScan.value ? `scan = "${latestScan.value.id}" && status = 'open'` : ''
    })
    policyCount.value = policies.length
  } catch {
    policyCount.value = 0
  }
})

function ringColor(count: number) {
  if (count === 0) return 'text-green-500'
  if (count <= 10) return 'text-amber-500'
  return 'text-red-500'
}
</script>

<template>
  <UDashboardPanel>
    <template #header>
      <UDashboardNavbar title="Quality Assurance">
        <template #leading><UDashboardSidebarCollapse /></template>
        <template #right><ScanTriggerButton :site-id="siteId" /></template>
      </UDashboardNavbar>
    </template>
    <template #body>
      <div class="grid md:grid-cols-4 gap-4 mb-8">
        <UCard :to="`/sites/${siteId}/qa/links`" class="cursor-pointer">
          <p class="text-sm text-muted">Broken Links</p>
          <p class="text-3xl font-bold" :class="ringColor(brokenLinkCount)">{{ brokenLinkCount }}</p>
        </UCard>
        <UCard :to="`/sites/${siteId}/qa/spelling`" class="cursor-pointer">
          <p class="text-sm text-muted">Misspellings</p>
          <p class="text-3xl font-bold" :class="ringColor(misspellingCount)">{{ misspellingCount }}</p>
        </UCard>
        <UCard :to="`/policies`" class="cursor-pointer">
          <p class="text-sm text-muted">Policies</p>
          <p class="text-3xl font-bold" :class="ringColor(policyCount)">{{ policyCount }}</p>
        </UCard>
        <UCard>
          <p class="text-sm text-muted">Readability</p>
          <p class="text-3xl font-bold">{{ avgReadability }}</p>
        </UCard>
      </div>
    </template>
  </UDashboardPanel>
</template>
