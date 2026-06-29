<script setup lang="ts">
import { siteSettingsForSite } from '~/utils/siteSettings'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const siteId = computed(() => route.params.id as string)
const { sites } = useSites()
const { brokenLinkCount, misspellingCount, avgReadability, latestScan } = useQA(siteId)
const { pb } = usePocketBase()
const policyCount = ref(0)

const siteSettings = computed(() =>
  siteSettingsForSite(sites.value.find(s => s.id === siteId.value))
)

const qaScore = computed(() => latestScan.value?.score_qa ?? null)

const overviewCardUi = {
  root: 'bg-elevated/25 border border-default',
  body: 'p-4 sm:p-6'
}

async function refreshPolicyCount() {
  try {
    if (!latestScan.value?.id) {
      policyCount.value = 0
      return
    }
    const policies = await pb.collection('policy_matches').getFullList({
      filter: `scan = "${latestScan.value.id}" && status = 'open'`
    })
    policyCount.value = policies.length
  } catch {
    policyCount.value = 0
  }
}

onMounted(async () => {
  await refreshPolicyCount()
})

watch(latestScan, () => {
  refreshPolicyCount()
})

function ringColor(count: number) {
  if (count === 0) return 'text-green-500'
  if (count <= 10) return 'text-amber-500'
  return 'text-red-500'
}
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Quality Assurance">
        <template #right><ScanTriggerButton :site-id="siteId" /></template>
      </DashboardPageNavbar>
    </template>
    <template #body>
      <SitePageToolbar class="mb-2" />
      <ScanStatusSummaryCard :scan="latestScan" title="QA Data Source" class="mb-6" />

      <section class="mb-6">
        <UCard :ui="overviewCardUi">
          <div class="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
            <SiteTargetSummary variant="qa" :settings="siteSettings" />
            <div class="flex flex-col items-center justify-center gap-2 min-h-[10rem]">
              <AccessibilityScoreDonut
                v-if="qaScore != null"
                :score="qaScore"
                label="QA score"
              />
              <p v-else class="text-sm text-muted text-center max-w-xs">
                QA score appears after a completed scan with quality checks enabled.
              </p>
            </div>
          </div>
        </UCard>
      </section>

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
  </AppDashboardPanel>
</template>
