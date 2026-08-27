<script setup lang="ts">
import {
  crawlLogLevelBadgeClass,
  crawlLogLevelClass,
  formatLogLevelLabel,
  formatLogTimestamp
} from '~/utils/crawlLog'
import type { CrawlLogLine } from '~/utils/crawlLog'
import {
  MARKETING_DEMO_CRAWL_ROTATION,
  MARKETING_DEMO_CRAWL_SEED
} from '~/utils/marketingDemoData'

const INITIAL_PAGES = 4
const CYCLE_MS = 10_000
const LINE_INTERVAL_MS = 2200
const VISIBLE_LOG_LINES = 8

function buildSeedLines(baseTs: number): CrawlLogLine[] {
  return MARKETING_DEMO_CRAWL_SEED.map((line, index) => ({
    id: `${line.id}-${baseTs}`,
    ts: baseTs + index * 800,
    level: line.level,
    message: line.message,
    url: line.url
  }))
}

const startedAt = ref(Date.now())
const pagesCrawled = ref(INITIAL_PAGES)
const elapsedTick = ref(0)
const rotationIndex = ref(0)
const lines = ref<CrawlLogLine[]>(buildSeedLines(startedAt.value))

let elapsedTimer: ReturnType<typeof setInterval> | null = null
let crawlTimer: ReturnType<typeof setInterval> | null = null
let resetTimer: ReturnType<typeof setInterval> | null = null

const elapsedLabel = computed(() => {
  void elapsedTick.value
  const totalSec = Math.max(0, Math.floor((Date.now() - startedAt.value) / 1000))
  const mins = Math.floor(totalSec / 60)
  const secs = totalSec % 60
  return `${mins}:${String(secs).padStart(2, '0')}`
})

const errorCount = computed(() =>
  lines.value.filter(line => line.level === 'error').length
)

/** Cap visible lines so the log grows in place without an inner scrollbar. */
const visibleLines = computed(() => lines.value.slice(-VISIBLE_LOG_LINES))

function appendNextLine() {
  const template = MARKETING_DEMO_CRAWL_ROTATION[
    rotationIndex.value % MARKETING_DEMO_CRAWL_ROTATION.length
  ]!
  rotationIndex.value++
  pagesCrawled.value += template.message === 'Crawled page' ? 1 : 0
  lines.value = [
    ...lines.value.slice(-40),
    {
      id: `${template.id}-${rotationIndex.value}-${startedAt.value}`,
      ts: Date.now(),
      level: template.level,
      message: template.message,
      url: template.url
    }
  ]
}

function resetCrawl() {
  startedAt.value = Date.now()
  pagesCrawled.value = INITIAL_PAGES
  rotationIndex.value = 0
  elapsedTick.value = 0
  lines.value = buildSeedLines(startedAt.value)
}

onMounted(() => {
  elapsedTimer = setInterval(() => {
    elapsedTick.value++
  }, 1000)
  crawlTimer = setInterval(appendNextLine, LINE_INTERVAL_MS)
  resetTimer = setInterval(resetCrawl, CYCLE_MS)
})

onUnmounted(() => {
  if (elapsedTimer) clearInterval(elapsedTimer)
  if (crawlTimer) clearInterval(crawlTimer)
  if (resetTimer) clearInterval(resetTimer)
})
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-default bg-elevated/20">
    <div class="border-b border-default p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-highlighted">
            Acme Research
          </p>
          <p class="mt-0.5 truncate text-sm text-muted">
            https://acme.example · Full scan
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-2 shrink-0">
          <StatusBadge status="Running" color="info" />
          <UButton
            label="Stop scan"
            size="sm"
            color="neutral"
            variant="outline"
            icon="i-lucide-square"
            @click.prevent
          />
        </div>
      </div>

      <div class="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span class="inline-flex items-center gap-1.5">
          <span class="text-muted">Pages</span>
          <span class="font-medium tabular-nums">{{ pagesCrawled }}</span>
        </span>
        <span class="hidden text-muted/40 sm:inline">·</span>
        <span class="inline-flex items-center gap-1.5">
          <span class="text-muted">Elapsed</span>
          <span class="font-mono font-medium tabular-nums">{{ elapsedLabel }}</span>
        </span>
        <span class="hidden text-muted/40 sm:inline">·</span>
        <span class="inline-flex items-center gap-1.5">
          <span class="text-muted">Started</span>
          <span class="font-medium">just now</span>
        </span>
        <span class="hidden text-muted/40 sm:inline">·</span>
        <span class="inline-flex items-center gap-1.5">
          <span class="text-muted">Type</span>
          <span class="font-medium">Full</span>
        </span>
        <span class="hidden text-muted/40 sm:inline">·</span>
        <span class="inline-flex items-center gap-1.5">
          <span class="text-muted">Errors</span>
          <span
            class="font-medium"
            :class="errorCount ? 'text-error' : ''"
          >
            {{ errorCount || 'None' }}
          </span>
        </span>
      </div>
    </div>

    <div class="demo-crawl">
      <div class="demo-crawl__header">
        <div class="flex min-w-0 items-center gap-2">
          <span class="demo-crawl__dot" />
          <h5 class="text-sm font-medium">
            Crawl activity
          </h5>
        </div>
        <UBadge color="success" variant="subtle" size="xs">
          Live
        </UBadge>
      </div>

      <div class="demo-crawl__body" role="log" aria-live="polite" aria-relevant="additions">
        <ul class="demo-crawl__list">
          <li
            v-for="line in visibleLines"
            :key="line.id"
            class="demo-crawl__item"
          >
            <time class="demo-crawl__time">{{ formatLogTimestamp(line.ts) }}</time>
            <span
              class="demo-crawl__badge"
              :class="crawlLogLevelBadgeClass(line.level)"
            >
              {{ formatLogLevelLabel(line.level) }}
            </span>
            <div class="min-w-0">
              <span
                v-if="line.url"
                class="demo-crawl__url"
                :class="crawlLogLevelClass(line.level)"
              >
                {{ line.url }}
              </span>
              <span
                v-if="line.url && line.message && !line.message.includes(line.url)"
                class="demo-crawl__msg demo-crawl__msg--secondary"
              >
                {{ line.message }}
              </span>
              <span
                v-else-if="!line.url"
                class="demo-crawl__msg"
                :class="crawlLogLevelClass(line.level)"
              >
                {{ line.message }}
              </span>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </div>
</template>

<style scoped>
.demo-crawl {
  display: flex;
  flex-direction: column;
}

.demo-crawl__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-bottom: 1px solid var(--ui-border);
  background: var(--ui-bg-muted, var(--ui-bg-elevated));
}

.demo-crawl__dot {
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 9999px;
  background: var(--ui-success);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-success) 25%, transparent);
  animation: demo-crawl-pulse 1.5s ease-in-out infinite;
}

@keyframes demo-crawl-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.demo-crawl__body {
  padding: 0.5rem 0;
  overflow: visible;
}

.demo-crawl__list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.demo-crawl__item {
  display: grid;
  grid-template-columns: 3.5rem 3rem minmax(0, 1fr);
  gap: 0.4rem;
  align-items: start;
  padding: 0.35rem 0.75rem;
  font-size: 0.75rem;
  line-height: 1.35;
}

@media (min-width: 640px) {
  .demo-crawl__item {
    grid-template-columns: 4.25rem 3.25rem minmax(0, 1fr);
    gap: 0.5rem;
    padding: 0.35rem 1rem;
  }
}

.demo-crawl__time {
  color: var(--ui-text-muted);
  font-variant-numeric: tabular-nums;
  font-family: ui-monospace, monospace;
}

.demo-crawl__badge {
  display: inline-flex;
  justify-content: center;
  border-radius: 0.25rem;
  padding: 0.05rem 0.3rem;
  font-size: 0.625rem;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.demo-crawl__url {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: ui-monospace, monospace;
}

.demo-crawl__msg {
  display: block;
}

.demo-crawl__msg--secondary {
  color: var(--ui-text-muted);
  margin-top: 0.1rem;
}

:deep(.crawl-log-badge--success) {
  color: var(--ui-success);
  background: color-mix(in srgb, var(--ui-success) 12%, transparent);
}

:deep(.crawl-log-badge--warn) {
  color: var(--ui-warning);
  background: color-mix(in srgb, var(--ui-warning) 12%, transparent);
}

:deep(.crawl-log-badge--error) {
  color: var(--ui-error);
  background: color-mix(in srgb, var(--ui-error) 12%, transparent);
}

:deep(.crawl-log-badge--info) {
  color: var(--ui-text-muted);
  background: color-mix(in srgb, var(--ui-text-muted) 10%, transparent);
}

:deep(.crawl-log-level--success) {
  color: var(--ui-success);
}

:deep(.crawl-log-level--warn) {
  color: var(--ui-warning);
}

:deep(.crawl-log-level--error) {
  color: var(--ui-error);
}

:deep(.crawl-log-level--info) {
  color: var(--ui-text);
}

@media (prefers-reduced-motion: reduce) {
  .demo-crawl__dot {
    animation: none;
  }
}
</style>
