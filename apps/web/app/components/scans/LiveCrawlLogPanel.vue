<script setup lang="ts">
import type { ActiveScanRow } from '~/types/sitenook'
import { crawlLogLevelBadgeClass, crawlLogLevelClass } from '~/utils/crawlLog'
import { summarizeCrawlLogErrors } from '~/utils/crawlLog'

const props = defineProps<{
  activeRow: ActiveScanRow | null
  stoppingRowId?: string | null
  /** Render inside a parent card. No outer chrome or duplicate stats. */
  embedded?: boolean
}>()

const emit = defineEmits<{
  errorsSummary: [string | null]
}>()

const {
  displayLines,
  lines: crawlLogLines,
  hiddenLineCount,
  loading,
  isLive,
  isWaitingForScanner,
  formatLogTimestamp,
  formatLogLevelLabel
} = useLiveCrawlLog(computed(() => props.activeRow))

const scrollEl = ref<HTMLElement | null>(null)
const stickToBottom = ref(true)
const SCROLL_THRESHOLD = 48

function isNearBottom(el: HTMLElement): boolean {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= SCROLL_THRESHOLD
}

function onScroll() {
  const el = scrollEl.value
  if (!el) return
  stickToBottom.value = isNearBottom(el)
}

async function scrollToBottomIfStuck() {
  if (!stickToBottom.value) return
  await nextTick()
  const el = scrollEl.value
  if (el) el.scrollTop = el.scrollHeight
}

watch(
  () => displayLines.value.length,
  () => {
    scrollToBottomIfStuck()
  }
)

watch(
  () => props.activeRow?.id,
  () => {
    stickToBottom.value = true
    scrollToBottomIfStuck()
  }
)

const showSelectPrompt = computed(() => !props.activeRow)

const showWaitingForScanner = computed(
  () => props.activeRow && isWaitingForScanner.value && !loading.value
)

const showLoading = computed(
  () => props.activeRow?.source === 'scan' && loading.value && displayLines.value.length === 0
)

const errorsSoFar = computed(() => summarizeCrawlLogErrors(crawlLogLines.value))

watch(
  errorsSoFar,
  (summary) => {
    emit('errorsSummary', summary)
  },
  { immediate: true }
)
</script>

<template>
  <div
    class="crawl-activity min-h-0"
    :class="{ 'crawl-activity--embedded': embedded }"
  >
    <div
      v-if="!embedded"
      class="crawl-activity__header"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span
          class="crawl-activity__dot shrink-0"
          :class="isLive ? 'crawl-activity__dot--live' : 'crawl-activity__dot--idle'"
        />
        <h3 class="text-sm font-medium">
          Crawl activity
        </h3>
      </div>
      <UBadge
        v-if="isLive"
        color="success"
        variant="subtle"
        size="xs"
      >
        Live
      </UBadge>
    </div>

    <div class="crawl-activity__scroll flex flex-col min-h-0 flex-1">
      <p
        v-if="hiddenLineCount > 0"
        class="crawl-activity__truncation shrink-0"
      >
        Showing latest {{ displayLines.length }} entries · {{ hiddenLineCount }} earlier hidden
      </p>

      <div
        ref="scrollEl"
        class="crawl-activity__body flex-1 min-h-0 scroll-region"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        @scroll="onScroll"
      >
        <p
          v-if="showSelectPrompt"
          class="crawl-activity__empty"
        >
          Select a scan to view crawl activity.
        </p>

        <div
          v-else-if="showLoading"
          class="crawl-activity__empty flex items-center justify-center gap-2"
        >
          <UIcon name="i-lucide-loader-circle" class="size-4 animate-spin text-muted" />
          Loading activity…
        </div>

        <div
          v-else-if="showWaitingForScanner"
          class="crawl-activity__empty text-center"
        >
          <UIcon name="i-lucide-clock" class="size-5 text-muted mx-auto mb-2" />
          <p class="font-medium text-sm">
            Waiting for scanner
          </p>
          <p class="text-xs text-muted mt-1 max-w-xs mx-auto">
            Activity will appear when the worker picks up this job.
          </p>
        </div>

        <ul v-else class="crawl-activity__list">
          <li
            v-for="line in displayLines"
            :key="line.id"
            class="crawl-activity__item"
            :class="{ 'crawl-activity__item--footer': line.id.startsWith('footer-') }"
          >
            <time class="crawl-activity__time">{{ formatLogTimestamp(line.ts) }}</time>
            <span
              class="crawl-activity__badge"
              :class="crawlLogLevelBadgeClass(line.level)"
            >
              {{ formatLogLevelLabel(line.level) }}
            </span>
            <div class="crawl-activity__content min-w-0">
              <a
                v-if="line.url"
                :href="line.url"
                target="_blank"
                rel="noopener noreferrer"
                class="crawl-activity__url"
                :class="crawlLogLevelClass(line.level)"
                @click.stop
              >
                {{ line.url }}
              </a>
              <span
                v-if="line.url && line.message && !line.message.includes(line.url)"
                class="crawl-activity__msg crawl-activity__msg--secondary"
              >
                {{ line.message }}
              </span>
              <span
                v-else-if="!line.url"
                class="crawl-activity__msg"
                :class="crawlLogLevelClass(line.level)"
              >
                {{ line.message }}
              </span>
            </div>
          </li>
        </ul>
      </div>

      <div
        v-if="!stickToBottom && displayLines.length"
        class="crawl-activity__resume shrink-0"
      >
        <UButton
          size="xs"
          color="neutral"
          variant="soft"
          label="Jump to latest"
          icon="i-lucide-arrow-down"
          @click="stickToBottom = true; scrollToBottomIfStuck()"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.crawl-activity {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
  flex: 1 1 auto;
  border-radius: 0.5rem;
  border: 1px solid var(--ui-border);
  background: var(--ui-bg-elevated, rgba(0, 0, 0, 0.02));
  overflow: hidden;
}

.crawl-activity--embedded {
  border: none;
  border-radius: 0;
  background: transparent;
}

.crawl-activity__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-muted, var(--ui-bg-elevated));
  flex-shrink: 0;
}

.crawl-activity__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
}

.crawl-activity__dot--live {
  background: var(--ui-success);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-success) 25%, transparent);
  animation: crawl-dot-pulse 1.5s ease-in-out infinite;
}

.crawl-activity__dot--idle {
  background: var(--ui-text-muted);
  opacity: 0.4;
}

@keyframes crawl-dot-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.crawl-activity__truncation {
  margin: 0;
  padding: 0.375rem 1rem;
  font-size: 0.6875rem;
  line-height: 1.35;
  color: var(--ui-text-muted);
  border-bottom: 1px solid var(--ui-border-muted, var(--ui-border));
  background: var(--ui-bg-muted, var(--ui-bg-elevated));
}

.crawl-activity__body {
  padding: 0.5rem 0;
  font-size: 0.8125rem;
  line-height: 1.45;
}

.crawl-activity__empty {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--ui-text-muted);
  font-size: 0.875rem;
}

.crawl-activity__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.crawl-activity__item {
  display: grid;
  grid-template-columns: 3.25rem 3.5rem 1fr;
  gap: 0.5rem 0.625rem;
  align-items: start;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--ui-border-muted, var(--ui-border));
}

.crawl-activity__item:last-child {
  border-bottom: none;
}

.crawl-activity__item:hover {
  background: color-mix(in srgb, var(--ui-bg-accented, var(--ui-bg-muted)) 50%, transparent);
}

.crawl-activity__item--footer {
  margin-top: 0.25rem;
  padding-top: 0.75rem;
  border-top: 1px dashed var(--ui-border);
  font-weight: 600;
}

.crawl-activity__time {
  font-size: 0.6875rem;
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
  padding-top: 0.125rem;
}

.crawl-activity__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.03em;
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  line-height: 1.2;
  margin-top: 0.0625rem;
}

:global(.crawl-log-badge--success) {
  color: var(--ui-success);
  background: color-mix(in srgb, var(--ui-success) 12%, transparent);
}

:global(.crawl-log-badge--warn) {
  color: var(--ui-warning);
  background: color-mix(in srgb, var(--ui-warning) 12%, transparent);
}

:global(.crawl-log-badge--error) {
  color: var(--ui-error);
  background: color-mix(in srgb, var(--ui-error) 12%, transparent);
}

:global(.crawl-log-badge--info) {
  color: var(--ui-text-muted);
  background: color-mix(in srgb, var(--ui-text-muted) 10%, transparent);
}

:global(.crawl-log-level--success) {
  color: var(--ui-success);
}

:global(.crawl-log-level--warn) {
  color: var(--ui-warning);
}

:global(.crawl-log-level--error) {
  color: var(--ui-error);
}

:global(.crawl-log-level--info) {
  color: var(--ui-text);
}

.crawl-activity__url {
  display: block;
  word-break: break-all;
  text-decoration: none;
  font-weight: 500;
}

.crawl-activity__url:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.crawl-activity__msg {
  display: block;
  word-break: break-word;
  color: var(--ui-text);
}

.crawl-activity__msg--secondary {
  color: var(--ui-text-muted);
  font-size: 0.75rem;
  margin-top: 0.125rem;
}

.crawl-activity__resume {
  padding: 0.375rem 0.75rem;
  border-top: 1px solid var(--ui-border);
  background: var(--ui-bg-muted, var(--ui-bg-elevated));
  display: flex;
  justify-content: center;
}
</style>
