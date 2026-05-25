<script setup lang="ts">
import type { Site } from '~/types/accessiq'
import {
  type ScanConfig,
  type HeaderRow,
  getDefaultScanConfig,
  parseScanConfig,
  parsePageUrls,
  countPageUrls,
  isValidHttpUrl,
  validateAuth,
  scopeSummary,
  accessibilitySummary,
  qaSummary,
  browserSummary,
  authSummary,
  notificationsSummary,
  advancedSummary,
  configFromHeaderRows,
  headerRowsFromConfig,
  getSiteHostname,
  deriveScanType,
  serializeScanConfig,
  frequencyToCrawlSchedule
} from '~/utils/scanConfig'

const props = defineProps<{
  site: Site | null
  initialPageUrl?: string
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  queued: []
  scheduleSaved: []
}>()

const { user } = usePocketBase()
const { queueScanWithConfig, saveDefaultScanConfig, saveSiteSchedule } = useSites()
const toast = useToast()
const config = useRuntimeConfig()

const maxPagesDefault = Number(config.public.maxPagesPerScan || 500)
const submitting = ref(false)
const pagesText = ref('')
const pagesTouched = ref(false)
const invalidPageLines = ref<number[]>([])
const sitemapCount = ref<number | null>(null)
const sitemapError = ref('')
const sitemapLoading = ref(false)
const headerRows = ref<HeaderRow[]>([{ key: '', value: '' }])
const authErrors = ref<string[]>([])

const configState = reactive<ScanConfig>(getDefaultScanConfig(undefined, maxPagesDefault))

const accordionOpen = ref<string | string[]>('scope')

const scanModeItems = [
  { label: 'Full Crawl', value: 'full', description: 'Discover and scan all pages automatically' },
  { label: 'Specific Pages', value: 'pages', description: 'Provide a list of exact URLs to scan' },
  { label: 'Sitemap', value: 'sitemap', description: 'Parse sitemap.xml and scan discovered URLs' }
]

const wcagVersionItems = [
  { label: 'WCAG 2.0', value: '2.0' },
  { label: 'WCAG 2.1', value: '2.1' },
  { label: 'WCAG 2.2', value: '2.2' }
]

const wcagLevelItems = [
  { label: 'Level A', value: 'A' },
  { label: 'Level AA', value: 'AA' },
  { label: 'Level AAA', value: 'AAA' }
]

const spellLanguageItems = [
  { label: 'English (AU)', value: 'en-AU' },
  { label: 'English (US)', value: 'en-US' },
  { label: 'English (UK)', value: 'en-GB' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Spanish', value: 'es' }
]

const viewportItems = [
  { label: 'Desktop (1280×800)', value: 'desktop' },
  { label: 'Tablet (768×1024)', value: 'tablet' },
  { label: 'Mobile (375×812)', value: 'mobile' }
]

const waitStrategyItems = [
  { label: 'Load event (fast)', value: 'load' },
  { label: 'Network idle (recommended)', value: 'networkidle' },
  { label: 'Fixed delay 2s', value: 'delay2s' },
  { label: 'Fixed delay 5s', value: 'delay5s' }
]

const authTypeItems = [
  { label: 'None', value: 'none' },
  { label: 'HTTP Basic Auth', value: 'basic' },
  { label: 'Login Form', value: 'form' },
  { label: 'Cookie / Session', value: 'cookie' },
  { label: 'Bearer Token', value: 'bearer' }
]

const scheduleFrequencyItems = [
  { label: 'Every hour', value: 'hourly' },
  { label: 'Every 6 hours', value: 'every_6h' },
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' }
]

const hostname = computed(() => (props.site ? getSiteHostname(props.site.url) : ''))
const pageUrlCount = computed(() => countPageUrls(pagesText.value))
const showScheduleTime = computed(() =>
  ['daily', 'weekly', 'monthly'].includes(configState.scheduleFrequency)
)
const primaryLabel = computed(() =>
  configState.scheduleEnabled ? 'Save Schedule' : 'Start Scan'
)

const notifyEnabled = computed({
  get: () => configState.notifyEmail !== null && configState.notifyEmail !== '',
  set: (enabled: boolean) => {
    configState.notifyEmail = enabled ? String(user.value?.email || '') : null
  }
})

const accordionItems = computed(() => [
  { label: `Scope  ›  ${scopeSummary(configState, pageUrlCount.value)}`, value: 'scope', slot: 'scope' as const },
  { label: `Accessibility  ›  ${accessibilitySummary(configState)}`, value: 'accessibility', slot: 'accessibility' as const },
  { label: `Quality Assurance  ›  ${qaSummary(configState)}`, value: 'qa', slot: 'qa' as const },
  { label: `Browser  ›  ${browserSummary(configState)}`, value: 'browser', slot: 'browser' as const },
  { label: `Authentication  ›  ${authSummary(configState)}`, value: 'auth', slot: 'auth' as const },
  { label: `Notifications  ›  ${notificationsSummary(configState)}`, value: 'notifications', slot: 'notifications' as const },
  { label: `Advanced  ›  ${advancedSummary(configState)}`, value: 'advanced', slot: 'advanced' as const }
])

function resetForm() {
  const site = props.site
  const saved = site?.default_scan_config
  const base = parseScanConfig(saved, site?.url, maxPagesDefault)

  if (props.initialPageUrl) {
    base.mode = 'pages'
    base.pages = [props.initialPageUrl]
    pagesText.value = props.initialPageUrl
  } else if (base.mode === 'pages' && base.pages.length) {
    pagesText.value = base.pages.join('\n')
  } else {
    pagesText.value = ''
  }

  Object.assign(configState, base)
  headerRows.value = headerRowsFromConfig(base.customHeaders)
  invalidPageLines.value = []
  pagesTouched.value = false
  sitemapCount.value = null
  sitemapError.value = ''
  authErrors.value = []

  configState.notifyEmail = null
}

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm()
    accordionOpen.value = 'scope'
  }
})

watch(() => props.site?.id, () => {
  if (open.value) resetForm()
})

watch(pagesText, (text) => {
  configState.pages = parsePageUrls(text)
})

function validatePageUrls() {
  pagesTouched.value = true
  const lines = pagesText.value.split('\n')
  invalidPageLines.value = []
  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (trimmed && !isValidHttpUrl(trimmed)) {
      invalidPageLines.value.push(index)
    }
  })
}

function addHeaderRow() {
  headerRows.value.push({ key: '', value: '' })
}

function removeHeaderRow(index: number) {
  headerRows.value.splice(index, 1)
  if (!headerRows.value.length) headerRows.value.push({ key: '', value: '' })
}

async function fetchSitemapPreview() {
  sitemapLoading.value = true
  sitemapError.value = ''
  sitemapCount.value = null
  try {
    const result = await $fetch<{ count: number }>('/api/sitemap-preview', {
      query: { url: configState.sitemapUrl }
    })
    sitemapCount.value = result.count
  } catch (e: unknown) {
    sitemapError.value = e && typeof e === 'object' && 'statusMessage' in e
      ? String((e as { statusMessage: string }).statusMessage)
      : 'Could not fetch sitemap'
  } finally {
    sitemapLoading.value = false
  }
}

function buildSubmitConfig(): ScanConfig {
  return {
    ...configState,
    pages: parsePageUrls(pagesText.value),
    customHeaders: configFromHeaderRows(headerRows.value)
  }
}

async function saveAsDefault() {
  if (!props.site) return
  const payload = serializeScanConfig(buildSubmitConfig())
  try {
    await saveDefaultScanConfig(props.site.id, payload)
    toast.add({ title: 'Default saved', description: 'This configuration will pre-fill next time.' })
  } catch (e: unknown) {
    toast.add({ title: 'Could not save default', description: String(e), color: 'error' })
  }
}

async function submit() {
  if (!props.site) return

  const finalConfig = buildSubmitConfig()
  authErrors.value = validateAuth(finalConfig)

  if (finalConfig.mode === 'pages') {
    validatePageUrls()
    if (!finalConfig.pages.length) {
      toast.add({ title: 'Add URLs', description: 'Enter at least one URL to scan.', color: 'warning' })
      return
    }
    if (invalidPageLines.value.length) {
      toast.add({ title: 'Invalid URLs', description: 'Fix highlighted URLs before starting.', color: 'error' })
      return
    }
  }

  if (finalConfig.mode === 'sitemap' && sitemapCount.value === null) {
    toast.add({
      title: 'Sitemap not verified',
      description: 'Consider fetching the sitemap preview first. You can still continue.',
      color: 'warning'
    })
  }

  if (authErrors.value.length) return

  submitting.value = true
  try {
    const raw = serializeScanConfig(finalConfig)

    if (finalConfig.scheduleEnabled) {
      await saveSiteSchedule(
        props.site.id,
        frequencyToCrawlSchedule(finalConfig.scheduleFrequency),
        raw
      )
      toast.add({ title: 'Schedule saved', description: 'Recurring scan schedule updated for this site.' })
      emit('scheduleSaved')
    } else {
      await queueScanWithConfig(props.site.id, raw, deriveScanType(finalConfig))
      toast.add({ title: 'Scan queued', description: 'The scanner will begin shortly.' })
      emit('queued')
    }

    open.value = false
  } catch (e: unknown) {
    toast.add({ title: 'Failed', description: String(e), color: 'error' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Configure Scan"
    :description="hostname"
    :ui="{ content: 'sm:max-w-4xl', description: 'text-gray-400' }"
  >

    <template #body>
      <UAccordion
        v-model="accordionOpen"
        type="multiple"
        :items="accordionItems"
        :unmount-on-hide="false"
        class="space-y-1"
      >
        <template #scope-body>
          <div class="space-y-5 pt-2">
            <UFormField label="Scan mode">
              <URadioGroup
                v-model="configState.mode"
                :items="scanModeItems"
                orientation="horizontal"
                variant="table"
              />
            </UFormField>

            <div v-if="configState.mode === 'full'" class="space-y-4">
              <div class="grid sm:grid-cols-2 gap-4">
                <UFormField label="Page limit" help="Scan stops after this many pages">
                  <UInput v-model.number="configState.maxPages" type="number" min="1" />
                </UFormField>
                <UFormField label="Max depth" help="How many links deep to follow from the homepage">
                  <UInput v-model.number="configState.maxDepth" type="number" min="1" />
                </UFormField>
              </div>
              <UFormField label="Stay on this domain" help="Don't follow links to external domains">
                <UToggle v-model="configState.stayOnDomain" />
              </UFormField>
              <UFormField label="Respect robots.txt" help="Skip pages disallowed by robots.txt">
                <UToggle v-model="configState.respectRobots" />
              </UFormField>
            </div>

            <div v-else-if="configState.mode === 'pages'" class="space-y-2">
              <UFormField
                label="URLs to scan (one per line)"
                help="Each URL is scanned independently. No crawling."
              >
                <UTextarea
                  v-model="pagesText"
                  :rows="6"
                  class="min-h-[120px] font-mono text-sm"
                  placeholder="https://example.com/about&#10;https://example.com/contact"
                  @blur="validatePageUrls"
                />
              </UFormField>
              <p class="text-sm text-muted">
                {{ pageUrlCount }} URL{{ pageUrlCount === 1 ? '' : 's' }} entered
              </p>
              <p v-if="pagesTouched && invalidPageLines.length" class="text-sm text-error">
                {{ invalidPageLines.length }} invalid URL line(s) — check format (https://…)
              </p>
            </div>

            <div v-else class="space-y-4">
              <UFormField label="Sitemap URL">
                <div class="flex gap-2">
                  <UInput v-model="configState.sitemapUrl" class="flex-1" />
                  <UButton
                    label="Fetch & Preview"
                    variant="outline"
                    :loading="sitemapLoading"
                    @click="fetchSitemapPreview"
                  />
                </div>
              </UFormField>
              <p v-if="sitemapCount !== null" class="text-sm text-success">
                Found {{ sitemapCount }} URLs in sitemap
              </p>
              <p v-if="sitemapError" class="text-sm text-error">{{ sitemapError }}</p>
              <UFormField label="Page limit" help="Scan stops after this many pages">
                <UInput v-model.number="configState.maxPages" type="number" min="1" />
              </UFormField>
            </div>

            <div class="border-t border-default pt-4 space-y-4">
              <UFormField
                label="Include patterns (optional)"
                help="Only scan URLs matching these glob patterns. Leave empty for all."
              >
                <UInputTags v-model="configState.includePatterns" placeholder="/blog/* or /products/*" />
              </UFormField>
              <UFormField
                label="Exclude patterns (optional)"
                help="Skip URLs matching these patterns."
              >
                <UInputTags v-model="configState.excludePatterns" placeholder="/admin/* or *.pdf" />
              </UFormField>
            </div>
          </div>
        </template>

        <template #accessibility-body>
          <div class="space-y-4 pt-2">
            <UFormField label="WCAG version">
              <USelectMenu v-model="configState.wcagVersion" :items="wcagVersionItems" value-key="value" />
            </UFormField>
            <UFormField label="Conformance levels" help="Uncheck levels you don't want to report on.">
              <UCheckboxGroup
                v-model="configState.wcagLevels"
                :items="wcagLevelItems"
                orientation="horizontal"
              />
            </UFormField>
            <UFormField label="Include best practice checks" help="Flags common issues beyond strict WCAG (e.g. missing &lt;h1&gt;, duplicate IDs)">
              <UToggle v-model="configState.bestPractices" />
            </UFormField>
          </div>
        </template>

        <template #qa-body>
          <div class="space-y-4 pt-2">
            <UFormField label="Check broken links" help="Verify all internal and external hyperlinks with HTTP HEAD requests">
              <UToggle v-model="configState.checkLinks" />
            </UFormField>
            <UFormField label="Spell check" help="Check page text against the selected dictionary">
              <UToggle v-model="configState.checkSpelling" />
            </UFormField>
            <UFormField v-if="configState.checkSpelling" label="Language">
              <USelectMenu v-model="configState.spellLanguage" :items="spellLanguageItems" value-key="value" />
            </UFormField>
            <UFormField label="Readability scoring" help="Calculate Flesch-Kincaid readability score per page">
              <UToggle v-model="configState.checkReadability" />
            </UFormField>
            <UFormField label="Run custom policies" help="Apply your saved keyword and regex policies during this scan">
              <UToggle v-model="configState.runPolicies" />
            </UFormField>
          </div>
        </template>

        <template #browser-body>
          <div class="space-y-4 pt-2">
            <UFormField label="Viewport" help="Viewport affects responsive layouts and may change which issues are detected">
              <URadioGroup v-model="configState.viewport" :items="viewportItems" orientation="horizontal" variant="table" />
            </UFormField>
            <UFormField
              label="Wait for page load"
              help="How long Playwright waits before running axe. Use Network idle for SPAs and JS-heavy sites."
            >
              <USelectMenu v-model="configState.waitStrategy" :items="waitStrategyItems" value-key="value" />
            </UFormField>
            <div class="grid sm:grid-cols-2 gap-4">
              <UFormField label="Parallel pages" help="Higher = faster scans but more memory. Reduce if the scanner crashes.">
                <UInput v-model.number="configState.concurrency" type="number" min="1" max="10" />
              </UFormField>
              <UFormField label="Page timeout (seconds)" help="Skip a page if it doesn't load within this time">
                <UInput v-model.number="configState.timeout" type="number" min="5" />
              </UFormField>
            </div>
          </div>
        </template>

        <template #auth-body>
          <div class="space-y-4 pt-2">
            <UFormField label="Auth type">
              <USelectMenu v-model="configState.auth.type" :items="authTypeItems" value-key="value" />
            </UFormField>

            <div v-if="configState.auth.type === 'basic'" class="grid sm:grid-cols-2 gap-4">
              <UFormField label="Username" :error="authErrors.includes('Username is required for HTTP Basic Auth')">
                <UInput v-model="configState.auth.username" />
              </UFormField>
              <UFormField label="Password" :error="authErrors.includes('Password is required for HTTP Basic Auth')">
                <UInput v-model="configState.auth.password" type="password" />
              </UFormField>
            </div>

            <div v-else-if="configState.auth.type === 'form'" class="space-y-4">
              <UFormField label="Login page URL">
                <UInput v-model="configState.auth.loginUrl" placeholder="https://example.com/login" />
              </UFormField>
              <div class="grid sm:grid-cols-2 gap-4">
                <UFormField label="Username field selector">
                  <UInput v-model="configState.auth.usernameSelector" />
                </UFormField>
                <UFormField label="Password field selector">
                  <UInput v-model="configState.auth.passwordSelector" />
                </UFormField>
              </div>
              <div class="grid sm:grid-cols-2 gap-4">
                <UFormField label="Username value">
                  <UInput v-model="configState.auth.username" />
                </UFormField>
                <UFormField label="Password value">
                  <UInput v-model="configState.auth.password" type="password" />
                </UFormField>
              </div>
              <UFormField label="Submit button selector">
                <UInput v-model="configState.auth.submitSelector" />
              </UFormField>
              <p class="text-sm text-muted">
                Playwright will fill and submit this form before starting the crawl, then reuse the authenticated session for all pages.
              </p>
            </div>

            <div v-else-if="configState.auth.type === 'cookie'">
              <UFormField label="Cookie string" help="Paste cookies from your browser's DevTools (Application → Cookies)">
                <UTextarea v-model="configState.auth.cookieString" placeholder="name=value; name2=value2" :rows="4" />
              </UFormField>
            </div>

            <div v-else-if="configState.auth.type === 'bearer'">
              <UFormField label="Token value" help="Sent as Authorization: Bearer &lt;token&gt; header on every request">
                <UInput v-model="configState.auth.token" type="password" />
              </UFormField>
            </div>
          </div>
        </template>

        <template #notifications-body>
          <div class="space-y-4 pt-2">
            <UFormField label="Email on completion" help="Send a summary report when this scan finishes">
              <UToggle v-model="notifyEnabled" />
            </UFormField>
            <UFormField v-if="notifyEnabled" label="Email address">
              <UInput v-model="configState.notifyEmail" type="email" />
            </UFormField>
            <UFormField label="Show diff from last scan" help="Highlight new issues introduced and issues fixed since the last scan">
              <UToggle v-model="configState.diffFromPrevious" />
            </UFormField>
            <UFormField label="Schedule this scan" help="Save as a recurring schedule for this site (replaces any existing schedule)">
              <UToggle v-model="configState.scheduleEnabled" />
            </UFormField>
            <div v-if="configState.scheduleEnabled" class="grid sm:grid-cols-2 gap-4">
              <UFormField label="Frequency">
                <USelectMenu v-model="configState.scheduleFrequency" :items="scheduleFrequencyItems" value-key="value" />
              </UFormField>
              <UFormField v-if="showScheduleTime" label="Run at">
                <UInput v-model="configState.scheduleTime" type="time" />
              </UFormField>
            </div>
          </div>
        </template>

        <template #advanced-body>
          <div class="space-y-4 pt-2">
            <UFormField label="Custom HTTP headers" help="Sent with every Playwright request. Useful for feature flags, bypass tokens, or CDN authentication.">
              <div class="space-y-2">
                <div
                  v-for="(row, index) in headerRows"
                  :key="index"
                  class="flex gap-2 items-center"
                >
                  <UInput v-model="row.key" placeholder="Header name" class="flex-1" />
                  <UInput v-model="row.value" placeholder="Value" class="flex-1" />
                  <UButton icon="i-lucide-x" color="neutral" variant="ghost" @click="removeHeaderRow(index)" />
                </div>
                <UButton label="Add header" icon="i-lucide-plus" size="sm" variant="outline" @click="addHeaderRow" />
              </div>
            </UFormField>
            <UFormField label="User agent override" help="Leave empty to use the default Chromium user agent">
              <UInput v-model="configState.userAgent" placeholder="Mozilla/5.0 ..." />
            </UFormField>
          </div>
        </template>
      </UAccordion>
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <UButton label="Save as default" variant="link" color="neutral" size="sm" @click="saveAsDefault" />
        <div class="flex gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="open = false" />
          <UButton
            :label="primaryLabel"
            color="primary"
            :loading="submitting"
            @click="submit"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
