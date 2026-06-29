<script setup lang="ts">
import type { SeoIssue } from '~/types/accessiq'
import {
  linkedAxeRule,
  ruleFixExample,
  ruleLabel,
  ruleWhyItMatters
} from '~/utils/seoRules'
import { scoreFieldDelta, formatScoreDelta } from '~/utils/scanScoreDelta'
import { trafficLightFromSeverity } from '~/utils/trafficLightStatus'

const props = defineProps<{
  issue: SeoIssue | null
  open: boolean
  siteId?: string
}>()

const emit = defineEmits<{ 'update:open': [value: boolean] }>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const accordionOpen = ref<string | undefined>('overview')

const siteIdRef = computed(() => props.siteId ?? '')
const { latestScan, fetchSEOData } = useSEO(siteIdRef)
const { sites, triggerScan } = useSites()
const toast = useToast()

const rescanning = ref(false)
const scoreDeltaBanner = ref<string | null>(null)
const scanBeforeRescan = ref(latestScan.value)

watch(
  () => props.issue?.id,
  () => {
    accordionOpen.value = 'overview'
    scoreDeltaBanner.value = null
  }
)

watch(latestScan, (next) => {
  if (!rescanning.value || !scanBeforeRescan.value || !next?.id || next.id === scanBeforeRescan.value.id) return
  if (next.status !== 'complete' && next.status !== 'complete_with_errors') return
  const delta = scoreFieldDelta(scanBeforeRescan.value, next, 'score_seo')
  if (delta) {
    scoreDeltaBanner.value = formatScoreDelta(delta, 'SEO score')
  }
  rescanning.value = false
})

const whyItMatters = computed(() =>
  props.issue ? ruleWhyItMatters(props.issue.rule_id) : ''
)

const fixExample = computed(() =>
  props.issue ? ruleFixExample(props.issue.rule_id) : null
)

const axeLink = computed(() => {
  if (!props.issue || !props.siteId) return null
  const axeRule = linkedAxeRule(props.issue.rule_id)
  if (!axeRule) return null
  return `/sites/${props.siteId}/accessibility/issues?rule=${axeRule}`
})

const evidenceSnippet = computed(() => {
  const evidence = props.issue?.evidence
  if (!evidence || typeof evidence !== 'object') return null
  const snippet = (evidence as { snippet?: string }).snippet
  const selector = (evidence as { selector?: string }).selector
  if (!snippet && !selector) return null
  return { snippet, selector }
})

const evidenceSampleUrls = computed(() => {
  const evidence = props.issue?.evidence
  if (!evidence || typeof evidence !== 'object') return null
  const count = (evidence as { count?: number }).count
  const sampleUrls = (evidence as { sampleUrls?: string[] }).sampleUrls
  if (!sampleUrls?.length) return null
  return { count, sampleUrls }
})

const accordionItems = computed(() => [
  { label: 'Overview', value: 'overview', slot: 'overview' as const },
  { label: 'What we found', value: 'found', slot: 'found' as const },
  { label: 'How to fix', value: 'fix', slot: 'fix' as const }
])

const pageUrl = computed(() => props.issue?.expand?.page?.url ?? '')

async function rescanPage() {
  if (!props.siteId || !pageUrl.value) return
  scanBeforeRescan.value = latestScan.value
  rescanning.value = true
  scoreDeltaBanner.value = null
  try {
    await triggerScan(props.siteId, 'seo_only', pageUrl.value)
    toast.add({ title: 'SEO page scan queued' })
    await fetchSEOData({ silent: true })
  } catch (e: unknown) {
    rescanning.value = false
    toast.add({
      title: 'Could not queue scan',
      description: e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed',
      color: 'error'
    })
  }
}

function copy(text: string) {
  navigator.clipboard.writeText(text)
  toast.add({ title: 'Copied to clipboard' })
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    :title="issue?.title ?? 'SEO issue'"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template v-if="issue" #body>
      <div class="space-y-4 max-h-[70vh] scroll-region">
        <UAlert
          v-if="scoreDeltaBanner"
          color="success"
          variant="subtle"
          :title="scoreDeltaBanner"
        />

        <div class="flex flex-wrap gap-2 items-center">
          <TrafficLightDot :status="trafficLightFromSeverity(issue.severity)" />
          <UBadge variant="subtle">{{ ruleLabel(issue.rule_id) }}</UBadge>
          <UBadge variant="subtle" class="capitalize">{{ issue.severity }}</UBadge>
          <UBadge variant="subtle" class="capitalize">{{ issue.category }}</UBadge>
        </div>

        <div v-if="pageUrl" class="flex flex-wrap items-center gap-2 text-sm">
          <span class="text-muted">Page:</span>
          <a
            :href="pageUrl"
            target="_blank"
            rel="noopener"
            class="text-primary hover:underline break-all"
          >
            {{ pageUrl }}
          </a>
          <UButton
            v-if="siteId"
            size="xs"
            variant="outline"
            icon="i-lucide-refresh-cw"
            :loading="rescanning"
            @click="rescanPage"
          >
            Rescan this page
          </UButton>
        </div>

        <UAccordion
          v-model="accordionOpen"
          type="single"
          :items="accordionItems"
          :unmount-on-hide="false"
          class="space-y-1"
        >
          <template #overview-body>
            <div class="space-y-3 pt-2">
              <p v-if="issue.description" class="text-sm">{{ issue.description }}</p>
              <p class="text-sm text-muted leading-relaxed">{{ whyItMatters }}</p>
              <UButton
                v-if="axeLink"
                :to="axeLink"
                variant="link"
                class="px-0"
                size="sm"
              >
                Also flagged in Accessibility →
              </UButton>
            </div>
          </template>

          <template #found-body>
            <div class="space-y-3 pt-2 text-sm">
              <div v-if="issue.current_value" class="rounded-lg bg-elevated/50 p-3">
                <p class="text-xs text-muted">Current</p>
                <p class="mt-1">{{ issue.current_value }}</p>
              </div>
              <div v-if="issue.expected_value" class="rounded-lg bg-elevated/50 p-3">
                <p class="text-xs text-muted">Expected</p>
                <p class="mt-1">{{ issue.expected_value }}</p>
              </div>
              <pre
                v-if="evidenceSnippet?.snippet"
                class="text-xs bg-default rounded-lg p-3 overflow-x-auto border border-default"
              ><code>{{ evidenceSnippet.snippet }}</code></pre>
              <p v-if="evidenceSnippet?.selector" class="text-xs text-muted">
                Selector: <code>{{ evidenceSnippet.selector }}</code>
              </p>
              <div v-if="evidenceSampleUrls" class="space-y-2">
                <p class="text-xs text-muted">
                  <template v-if="evidenceSampleUrls.count">
                    {{ evidenceSampleUrls.count }} URL(s) affected (showing {{ evidenceSampleUrls.sampleUrls.length }} examples)
                  </template>
                  <template v-else>Example URLs</template>
                </p>
                <ul class="text-xs space-y-1 break-all">
                  <li v-for="sampleUrl in evidenceSampleUrls.sampleUrls" :key="sampleUrl">
                    <a
                      :href="sampleUrl"
                      target="_blank"
                      rel="noopener"
                      class="text-primary hover:underline"
                    >{{ sampleUrl }}</a>
                  </li>
                </ul>
              </div>
            </div>
          </template>

          <template #fix-body>
            <div class="space-y-3 pt-2">
              <UCard v-if="issue.recommendation" :ui="{ body: 'p-4' }">
                <p class="text-xs text-muted mb-1">Recommendation</p>
                <p class="text-sm">{{ issue.recommendation }}</p>
              </UCard>
              <div v-if="fixExample" class="space-y-2">
                <p class="text-xs text-muted">Example markup</p>
                <pre class="text-xs bg-elevated rounded-lg p-3 overflow-x-auto border border-default"><code>{{ fixExample }}</code></pre>
                <UButton size="sm" variant="outline" @click="copy(fixExample)">
                  Copy example
                </UButton>
              </div>
            </div>
          </template>
        </UAccordion>
      </div>
    </template>
  </UModal>
</template>
