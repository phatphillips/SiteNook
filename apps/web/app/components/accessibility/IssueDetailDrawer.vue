<script setup lang="ts">
import type { AccessibilityIssue, Scan } from '~/types/sitenook'
import type { AffectedPageDetail, AffectedPageSummary } from '~/utils/affectedPages'
import {
  getIssueFixSteps,
  getIssueWhyItMatters,
  getWcagUnderstandingUrl
} from '~/utils/issueExplanation'
import {
  issueNonWcagScopeNote,
  issueTargetCategory,
  issueTargetCategoryDescription,
  issueTargetCategoryLabel,
  issueWcagConformanceLabel
} from '~/utils/issueLabels'
import { scoreFieldDelta, formatScoreDelta } from '~/utils/scanScoreDelta'
import { trafficLightFromImpact } from '~/utils/trafficLightStatus'
import { dismissActionItems, type DismissReason } from '~/utils/issueActions'

const SNIPPET_PREVIEW_CHARS = 480

const props = defineProps<{
  issue: AccessibilityIssue | null
  open: boolean
  affectedPages?: Array<AffectedPageDetail | AffectedPageSummary>
  siteId?: string
  scans?: Scan[]
  onRefresh?: () => Promise<void>
  /** When true, hide dismiss / mark-fixed actions. */
  readOnly?: boolean
  /** Parent is processing a dismiss/fix. */
  busy?: boolean
  /** Preferred async handlers. Awaited so the drawer can show loading/success correctly. */
  onDismissIssue?: (reason: DismissReason) => void | Promise<void>
  onMarkIssueFixed?: () => void | Promise<void>
}>()

const emit = defineEmits<{
  'update:open': [boolean]
  dismiss: [reason: DismissReason]
  markFixed: []
}>()

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
const pendingAction = ref<'dismiss' | 'fixed' | null>(null)
const actionSuccess = ref<'dismiss' | 'fixed' | null>(null)
const snippetExpanded = ref(false)

const isBusy = computed(() => props.busy || !!pendingAction.value)

const displayIssue = computed(() => detailIssue.value ?? props.issue)

watch(
  () => [props.open, props.issue?.id] as const,
  async ([open, issueId]) => {
    if (!open || !issueId) {
      detailIssue.value = null
      actionSuccess.value = null
      pendingAction.value = null
      return
    }
    if (issueId.startsWith('rule:')) {
      detailIssue.value = props.issue
      return
    }
    detailLoading.value = true
    try {
      if (!pb) {
        detailIssue.value = props.issue
        return
      }
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
    scoreDeltaBanner.value = null
    detailIssue.value = null
    actionSuccess.value = null
    pendingAction.value = null
    snippetExpanded.value = false
  }
)

const affectedPages = computed(() => props.affectedPages ?? [])

const pageUrl = computed(() => {
  const fromExpand = displayIssue.value?.expand?.page?.url?.trim()
  if (fromExpand) return fromExpand
  const first = affectedPages.value[0]
  return first?.url?.trim() ?? ''
})

const pageTitle = computed(() => displayIssue.value?.expand?.page?.title?.trim() || '')

const otherAffectedCount = computed(() => {
  if (affectedPages.value.length <= 1) return 0
  return affectedPages.value.length - 1
})

const rescanPageUrl = computed(() => pageUrl.value)

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

const whyItMatters = computed(() =>
  displayIssue.value ? getIssueWhyItMatters(displayIssue.value) : ''
)

const fixSteps = computed(() =>
  displayIssue.value ? getIssueFixSteps(displayIssue.value) : []
)

const fixCopyText = computed(() => fixSteps.value.join('\n'))

const wcagUnderstandingUrl = computed(() => {
  if (!displayIssue.value || issueTargetCategory(displayIssue.value) !== 'wcag') return ''
  return getWcagUnderstandingUrl(displayIssue.value)
})

const issueCategory = computed(() =>
  displayIssue.value ? issueTargetCategory(displayIssue.value) : null
)

const wcagConformanceLabel = computed(() =>
  displayIssue.value ? issueWcagConformanceLabel(displayIssue.value) : null
)

const scopeNote = computed(() =>
  displayIssue.value ? issueNonWcagScopeNote(displayIssue.value) : null
)

const showWcagResource = computed(() =>
  !!wcagUnderstandingUrl.value && !!displayIssue.value?.wcag_sc
)

const impactBadgeColor = computed(() => {
  const impact = displayIssue.value?.impact
  if (impact === 'critical') return 'error' as const
  if (impact === 'serious') return 'warning' as const
  return 'neutral' as const
})

const cssSelector = computed(() => {
  const fromIssue = displayIssue.value?.css_selector?.trim()
  if (fromIssue) return fromIssue
  const first = affectedPages.value[0] as AffectedPageDetail | undefined
  return first?.cssSelector?.trim() ?? ''
})

const htmlSnippet = computed(() => {
  const fromIssue = displayIssue.value?.html_snippet?.trim()
  if (fromIssue) return fromIssue
  const first = affectedPages.value[0] as AffectedPageDetail | undefined
  return first?.htmlSnippet?.trim() ?? ''
})

const snippetIsLong = computed(() => htmlSnippet.value.length > SNIPPET_PREVIEW_CHARS)

const displayedSnippet = computed(() => {
  if (!htmlSnippet.value) return ''
  if (snippetExpanded.value || !snippetIsLong.value) return htmlSnippet.value
  return `${htmlSnippet.value.slice(0, SNIPPET_PREVIEW_CHARS)}…`
})

const hasEvidence = computed(() => !!cssSelector.value || !!htmlSnippet.value)

const hasResources = computed(() =>
  !!displayIssue.value?.help_url || !!wcagUnderstandingUrl.value
)

const dismissMenuItems = computed(() => [
  dismissActionItems(async (reason) => {
    await handleDismiss(reason)
  })
])

const showIssueActions = computed(() => !props.readOnly && !!props.siteId && !!displayIssue.value)

function copy(text: string) {
  navigator.clipboard.writeText(text)
  toast.add({ title: 'Copied to clipboard' })
}

async function handleDismiss(reason: DismissReason) {
  if (isBusy.value) return
  pendingAction.value = 'dismiss'
  actionSuccess.value = null
  try {
    if (props.onDismissIssue) {
      await props.onDismissIssue(reason)
    } else {
      emit('dismiss', reason)
    }
    actionSuccess.value = 'dismiss'
  } catch {
    // Error toast shown by actions composable.
  } finally {
    pendingAction.value = null
  }
}

async function handleMarkFixed() {
  if (isBusy.value) return
  pendingAction.value = 'fixed'
  actionSuccess.value = null
  try {
    if (props.onMarkIssueFixed) {
      await props.onMarkIssueFixed()
    } else {
      emit('markFixed')
    }
    actionSuccess.value = 'fixed'
  } catch {
    // Error toast shown by actions composable.
  } finally {
    pendingAction.value = null
  }
}

async function rescanPage() {
  if (!props.siteId || !rescanPageUrl.value || isBusy.value) return
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
    :dismissible="!isBusy"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template v-if="displayIssue" #body>
      <div v-if="detailLoading" class="flex justify-center py-8">
        <UIcon name="i-lucide-loader-circle" class="size-6 animate-spin" />
      </div>
      <div v-else class="space-y-5 max-h-[75vh] scroll-region">
        <UAlert
          v-if="scoreDeltaBanner"
          color="success"
          variant="subtle"
          :title="scoreDeltaBanner"
        />

        <Transition name="action-success">
          <UAlert
            v-if="actionSuccess"
            color="success"
            variant="subtle"
            :title="actionSuccess === 'fixed' ? 'Marked as fixed' : 'Issue dismissed'"
            :description="actionSuccess === 'fixed'
              ? 'This issue will drop out of the open list.'
              : 'This issue has been removed from the open list.'"
            icon="i-lucide-check-circle"
          />
        </Transition>

        <!-- Badges -->
        <div class="space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <TrafficLightDot :status="trafficLightFromImpact(displayIssue.impact)" />
            <UBadge
              v-if="issueCategory"
              variant="subtle"
              :title="issueTargetCategoryDescription(issueCategory)"
            >
              {{ issueTargetCategoryLabel(issueCategory) }}
            </UBadge>
            <UBadge
              v-if="wcagConformanceLabel"
              variant="subtle"
            >
              {{ wcagConformanceLabel }}
            </UBadge>
            <UBadge :color="impactBadgeColor" variant="subtle" class="capitalize">
              {{ displayIssue.impact }}
            </UBadge>
            <UBadge
              v-if="displayIssue.element_type"
              variant="subtle"
              class="capitalize"
            >
              {{ displayIssue.element_type }}
            </UBadge>
            <UBadge
              v-if="displayIssue.responsible_role"
              variant="subtle"
              class="capitalize"
            >
              {{ displayIssue.responsible_role }}
            </UBadge>
          </div>
          <div class="flex flex-wrap items-center gap-2 text-xs text-muted">
            <span class="uppercase tracking-wide">axe rule</span>
            <code class="font-mono text-highlighted">{{ displayIssue.rule_id }}</code>
          </div>
          <p v-if="scopeNote" class="text-xs text-muted leading-relaxed">
            {{ scopeNote }}
          </p>
        </div>

        <!-- Page context -->
        <div v-if="pageUrl" class="space-y-1.5">
          <div class="flex flex-wrap items-start gap-2 text-sm">
            <span class="text-muted shrink-0 pt-0.5">Page</span>
            <div class="min-w-0 flex-1 space-y-0.5">
              <a
                :href="pageUrl"
                target="_blank"
                rel="noopener"
                class="text-primary hover:underline break-all"
              >
                {{ pageUrl }}
              </a>
              <p v-if="pageTitle" class="text-xs text-muted truncate">
                {{ pageTitle }}
              </p>
            </div>
            <UButton
              v-if="siteId && rescanPageUrl"
              size="xs"
              variant="outline"
              icon="i-lucide-refresh-cw"
              :loading="rescanning"
              :disabled="isBusy"
              @click="rescanPage"
            >
              Rescan
            </UButton>
          </div>
          <p v-if="otherAffectedCount > 0" class="text-xs text-muted">
            Also on {{ otherAffectedCount }} other page{{ otherAffectedCount === 1 ? '' : 's' }}
            (see the issues table for the full list).
          </p>
        </div>

        <!-- Actions -->
        <div
          v-if="showIssueActions"
          class="flex flex-wrap items-center gap-2 border-y border-default py-3"
        >
          <UDropdownMenu :items="dismissMenuItems" :content="{ align: 'start' }" :disabled="isBusy">
            <UButton
              size="sm"
              variant="outline"
              icon="i-lucide-x"
              :loading="pendingAction === 'dismiss' || (isBusy && actionSuccess === 'dismiss')"
              :disabled="isBusy"
            >
              Dismiss
            </UButton>
          </UDropdownMenu>
          <UButton
            size="sm"
            color="primary"
            variant="soft"
            icon="i-lucide-check"
            :loading="pendingAction === 'fixed' || (isBusy && actionSuccess === 'fixed')"
            :disabled="isBusy"
            @click="handleMarkFixed"
          >
            Mark as fixed
          </UButton>
        </div>

        <!-- Why it matters -->
        <section class="space-y-2">
          <h4 class="text-sm font-medium text-highlighted">
            Why it matters
          </h4>
          <p class="text-sm text-muted leading-relaxed">
            {{ whyItMatters }}
          </p>
        </section>

        <!-- What we found -->
        <section class="space-y-2">
          <h4 class="text-sm font-medium text-highlighted">
            What we found
          </h4>
          <div
            v-if="hasEvidence"
            class="rounded-lg border border-default bg-elevated/40 divide-y divide-default overflow-hidden"
          >
            <div
              v-if="cssSelector"
              class="flex flex-wrap items-start gap-2 px-3 py-2.5"
            >
              <div class="min-w-0 flex-1 space-y-1">
                <p class="text-xs text-muted">
                  Selector
                </p>
                <code class="text-xs break-all text-highlighted">{{ cssSelector }}</code>
              </div>
              <UButton
                size="xs"
                variant="ghost"
                icon="i-lucide-copy"
                aria-label="Copy selector"
                @click="copy(cssSelector)"
              />
            </div>
            <div v-if="htmlSnippet" class="px-3 py-2.5 space-y-2">
              <div class="flex items-center justify-between gap-2">
                <p class="text-xs text-muted">
                  HTML
                </p>
                <UButton
                  size="xs"
                  variant="ghost"
                  icon="i-lucide-copy"
                  aria-label="Copy HTML snippet"
                  @click="copy(htmlSnippet)"
                />
              </div>
              <pre
                class="text-xs font-mono bg-default rounded-md p-3 overflow-x-auto border border-default leading-relaxed whitespace-pre-wrap break-all"
              ><code>{{ displayedSnippet }}</code></pre>
              <UButton
                v-if="snippetIsLong"
                size="xs"
                variant="link"
                class="px-0"
                @click="snippetExpanded = !snippetExpanded"
              >
                {{ snippetExpanded ? 'Show less' : 'Show full snippet' }}
              </UButton>
            </div>
          </div>
          <p v-else class="text-sm text-muted">
            No element snapshot was stored for this issue. Use the page link and documentation below to locate and fix it.
          </p>
        </section>

        <!-- How to fix -->
        <section class="space-y-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h4 class="text-sm font-medium text-highlighted">
              How to fix
            </h4>
            <UButton
              v-if="fixCopyText"
              size="xs"
              variant="outline"
              icon="i-lucide-copy"
              @click="copy(fixCopyText)"
            >
              Copy guidance
            </UButton>
          </div>
          <ol
            v-if="fixSteps.length"
            class="list-decimal list-outside ms-4 space-y-2 text-sm text-muted leading-relaxed"
          >
            <li v-for="(step, idx) in fixSteps" :key="idx">
              {{ step }}
            </li>
          </ol>
          <p v-else class="text-sm text-muted">
            No specific fix steps are available for this rule. See the documentation links below.
          </p>
        </section>

        <!-- Resources -->
        <section v-if="hasResources" class="space-y-2 pt-1 border-t border-default">
          <h4 class="text-sm font-medium text-highlighted">
            Resources
          </h4>
          <div class="flex flex-wrap gap-2">
            <UButton
              v-if="displayIssue.help_url"
              :to="displayIssue.help_url"
              target="_blank"
              size="sm"
              variant="outline"
              icon="i-lucide-external-link"
              trailing
            >
              axe-core docs
            </UButton>
            <UButton
              v-if="showWcagResource"
              :to="wcagUnderstandingUrl"
              target="_blank"
              size="sm"
              variant="outline"
              icon="i-lucide-external-link"
              trailing
            >
              WCAG {{ displayIssue.wcag_sc }}
            </UButton>
          </div>
        </section>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
.action-success-enter-active {
  transition: opacity 180ms ease, transform 180ms ease;
}
.action-success-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
.action-success-enter-to {
  opacity: 1;
  transform: translateY(0);
}
</style>
