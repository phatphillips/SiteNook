<script setup lang="ts">
import type { AccessibilityIssue, Scan } from '~/types/accessiq'
import type { AffectedPageDetail } from '~/utils/affectedPages'
import { getIssueWhyItMatters } from '~/utils/issueExplanation'
import { scoreFieldDelta, formatScoreDelta } from '~/utils/scanScoreDelta'
import { trafficLightFromImpact } from '~/utils/trafficLightStatus'

const props = defineProps<{
  issue: AccessibilityIssue | null
  open: boolean
  affectedPages?: AffectedPageDetail[]
  siteId?: string
  scans?: Scan[]
  onRefresh?: () => Promise<void>
  /** Legacy — actions removed; kept for overview compatibility. */
  readOnly?: boolean
}>()

const emit = defineEmits<{ 'update:open': [boolean] }>()

const openModel = computed({
  get: () => props.open,
  set: (value: boolean) => emit('update:open', value)
})

const scansRef = computed(() => props.scans ?? [])
const { triggerScan } = useSites()
const { pb } = usePocketBase()
const toast = useToast()

const detailIssue = ref<AccessibilityIssue | null>(null)
const detailLoading = ref(false)

const displayIssue = computed(() => detailIssue.value ?? props.issue)

watch(
  () => [props.open, props.issue?.id] as const,
  async ([open, issueId]) => {
    if (!open || !issueId) {
      detailIssue.value = null
      return
    }
    if (issueId.startsWith('rule:')) {
      detailIssue.value = props.issue
      return
    }
    detailLoading.value = true
    try {
      detailIssue.value = await pb.collection('accessibility_issues').getOne(issueId) as unknown as AccessibilityIssue
    } catch {
      detailIssue.value = props.issue
    } finally {
      detailLoading.value = false
    }
  },
  { immediate: true }
)

const rescanning = ref(false)
const scoreDeltaBanner = ref<string | null>(null)
const scanBeforeRescan = ref<Scan | null>(null)

const latestCompleteScan = computed(() =>
  scansRef.value.find(s => s.status === 'complete' || s.status === 'complete_with_errors') ?? null
)

watch(
  () => props.issue?.id,
  () => {
    accordionOpen.value = 'pages'
    scoreDeltaBanner.value = null
    detailIssue.value = null
  }
)

const affectedPages = computed(() => props.affectedPages ?? [])

const rescanPageUrl = computed(() => affectedPages.value[0]?.url ?? '')

watch(scansRef, () => {
  const latest = latestCompleteScan.value
  if (!rescanning.value || !scanBeforeRescan.value || !latest?.id || latest.id === scanBeforeRescan.value.id) return
  if (latest.status !== 'complete' && latest.status !== 'complete_with_errors') return
  const delta = scoreFieldDelta(scanBeforeRescan.value, latest, 'score_overall')
  if (delta) {
    scoreDeltaBanner.value = formatScoreDelta(delta, 'Accessibility score')
  }
  rescanning.value = false
}, { deep: true })

const accordionOpen = ref<string | undefined>('pages')

const whyItMatters = computed(() =>
  displayIssue.value ? getIssueWhyItMatters(displayIssue.value) : ''
)

const wcagUnderstandingUrl = computed(() => {
  const sc = displayIssue.value?.wcag_sc
  if (!sc) return ''
  return `https://www.w3.org/WAI/WCAG22/Understanding/${sc.replace(/\./g, '')}`
})

const accordionItems = computed(() => [
  { label: 'Overview', value: 'overview', slot: 'overview' as const },
  { label: 'Pages & code', value: 'pages', slot: 'pages' as const },
  { label: 'How to Fix', value: 'fix', slot: 'fix' as const },
  { label: 'Resources', value: 'resources', slot: 'resources' as const }
])

function copy(text: string) {
  navigator.clipboard.writeText(text)
  useToast().add({ title: 'Copied to clipboard' })
}

async function rescanPage() {
  if (!props.siteId || !rescanPageUrl.value) return
  scanBeforeRescan.value = latestCompleteScan.value
  rescanning.value = true
  scoreDeltaBanner.value = null
  try {
    await triggerScan(props.siteId, 'full', rescanPageUrl.value)
    toast.add({ title: 'Page scan queued' })
    await props.onRefresh?.()
  } catch (e: unknown) {
    rescanning.value = false
    toast.add({
      title: 'Could not queue scan',
      description: e && typeof e === 'object' && 'message' in e ? String((e as { message: string }).message) : 'Request failed',
      color: 'error'
    })
  }
}
</script>

<template>
  <UModal
    v-model:open="openModel"
    :title="displayIssue?.description ?? 'Issue details'"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template v-if="displayIssue" #body>
      <div v-if="detailLoading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
      </div>
      <div v-else class="space-y-4 max-h-[70vh] scroll-region">
        <UAlert
          v-if="scoreDeltaBanner"
          color="success"
          variant="subtle"
          :title="scoreDeltaBanner"
        />

        <div class="flex flex-wrap gap-2">
          <TrafficLightDot :status="trafficLightFromImpact(displayIssue.impact)" />
          <UBadge variant="subtle">{{ displayIssue.wcag_level }}</UBadge>
          <UBadge :color="displayIssue.impact === 'critical' ? 'error' : 'warning'" variant="subtle">
            {{ displayIssue.impact }}
          </UBadge>
          <UBadge variant="subtle">{{ displayIssue.rule_id }}</UBadge>
        </div>

        <div v-if="siteId && rescanPageUrl" class="flex justify-end">
          <UButton
            size="sm"
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
              <p class="text-sm text-muted leading-relaxed">
                {{ whyItMatters }}
              </p>
            </div>
          </template>

          <template #pages-body>
            <div class="pt-2 space-y-4">
              <p v-if="!affectedPages?.length" class="text-sm text-muted">
                No affected pages linked for this issue.
              </p>
              <article
                v-for="page in affectedPages"
                :key="page.url"
                class="rounded-lg border border-default bg-elevated/30 p-3 space-y-2"
              >
                <a
                  :href="page.url"
                  target="_blank"
                  rel="noopener"
                  class="text-sm text-primary hover:underline break-all font-medium"
                >
                  {{ page.url }}
                </a>
                <pre
                  v-if="page.htmlSnippet"
                  class="text-xs bg-default rounded-lg p-3 overflow-x-auto border border-default ring-1 ring-default/50"
                ><code>{{ page.htmlSnippet }}</code></pre>
                <p v-else class="text-xs text-muted">No HTML snippet captured for this page.</p>
                <div v-if="page.cssSelector" class="flex items-start gap-2">
                  <code class="text-xs flex-1 break-all text-muted">{{ page.cssSelector }}</code>
                  <UButton size="xs" variant="outline" @click="copy(page.cssSelector || '')">
                    Copy selector
                  </UButton>
                </div>
              </article>
            </div>
          </template>

          <template #fix-body>
            <div class="space-y-3 pt-2">
              <p class="text-sm text-muted">
                {{ displayIssue.fix_suggestion || 'See the Resources section for guidance.' }}
              </p>
              <UButton
                v-if="displayIssue.fix_suggestion"
                size="sm"
                variant="outline"
                @click="copy(displayIssue.fix_suggestion || '')"
              >
                Copy fix guidance
              </UButton>
            </div>
          </template>

          <template #resources-body>
            <div class="space-y-2 pt-2">
              <UButton
                v-if="displayIssue.help_url"
                :to="displayIssue.help_url"
                target="_blank"
                variant="link"
                class="px-0"
                block
              >
                axe-core rule documentation
              </UButton>
              <UButton
                v-if="wcagUnderstandingUrl"
                :to="wcagUnderstandingUrl"
                target="_blank"
                variant="link"
                class="px-0"
                block
              >
                WCAG Success Criterion {{ displayIssue.wcag_sc }}
              </UButton>
              <p v-if="!displayIssue.help_url && !displayIssue.wcag_sc" class="text-sm text-muted">
                No external resources linked for this rule.
              </p>
            </div>
          </template>
        </UAccordion>
      </div>
    </template>
  </UModal>
</template>
