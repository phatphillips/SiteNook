<script setup lang="ts">
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
  browserSummary,
  authSummary,
  advancedSummary,
  configFromHeaderRows,
  headerRowsFromConfig,
  normalizeScanConfig
} from '~/utils/scanConfig'

const props = defineProps<{
  siteUrl: string
  initialRawConfig?: Record<string, unknown> | null
  initialPageUrl?: string
  maxPagesDefault?: number
}>()

const config = useRuntimeConfig()
const maxPages = computed(() => props.maxPagesDefault ?? Number(config.public.maxPagesPerScan || 500))

type ScanConfigTab = 'scope' | 'browser' | 'auth' | 'advanced'

const configState = reactive<ScanConfig>(getDefaultScanConfig(undefined, maxPages.value))
const activeTab = ref<ScanConfigTab>('scope')
const pagesText = ref('')
const pagesTouched = ref(false)
const invalidPageLines = ref<number[]>([])
const sitemapCount = ref<number | null>(null)
const sitemapError = ref('')
const sitemapLoading = ref(false)
const headerRows = ref<HeaderRow[]>([{ key: '', value: '' }])
const authErrors = ref<string[]>([])

const scanModeItems = [
  { label: 'Full Crawl', value: 'full', description: 'Discover and scan all pages automatically' },
  { label: 'Specific Pages', value: 'pages', description: 'Provide a list of exact URLs to scan' },
  { label: 'Sitemap', value: 'sitemap', description: 'Parse sitemap.xml and scan discovered URLs' }
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
  { label: 'Fixed delay 10s (WAF-friendly)', value: 'delay10s' }
]

const authTypeItems = [
  { label: 'None', value: 'none' },
  { label: 'HTTP Basic Auth', value: 'basic' },
  { label: 'Login Form', value: 'form' },
  { label: 'Cookie / Session', value: 'cookie' },
  { label: 'Bearer Token', value: 'bearer' }
]

const pageUrlCount = computed(() => countPageUrls(pagesText.value))

const tabItems = [
  { label: 'Scope', value: 'scope' },
  { label: 'Browser', value: 'browser' },
  { label: 'Authentication', value: 'auth' },
  { label: 'Advanced', value: 'advanced' }
]

const tabSummary = computed(() => {
  switch (activeTab.value) {
    case 'scope': return scopeSummary(configState, pageUrlCount.value)
    case 'browser': return browserSummary(configState)
    case 'auth': return authSummary(configState)
    case 'advanced': return advancedSummary(configState)
  }
})

function resetForm() {
  const base = parseScanConfig(props.initialRawConfig, props.siteUrl, maxPages.value)

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
  activeTab.value = 'scope'
}

watch(() => [props.siteUrl, props.initialRawConfig, props.initialPageUrl] as const, () => {
  resetForm()
}, { immediate: true })

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

const { pb, awaitAuthReady } = usePocketBase()

async function fetchSitemapPreview() {
  sitemapLoading.value = true
  sitemapError.value = ''
  sitemapCount.value = null
  try {
    await awaitAuthReady()
    const token = pb?.authStore.token
    if (!token) {
      sitemapError.value = 'Sign in again to preview the sitemap.'
      return
    }
    const result = await $fetch<{ count: number }>('/api/sitemap-preview', {
      query: { url: configState.sitemapUrl },
      headers: { Authorization: token }
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
  return normalizeScanConfig({
    ...configState,
    pages: parsePageUrls(pagesText.value),
    customHeaders: configFromHeaderRows(headerRows.value)
  })
}

export type ScanConfigValidationResult =
  | { ok: true, config: ScanConfig }
  | { ok: false, message: string, color?: 'warning' | 'error' }

function validateForSubmit(): ScanConfigValidationResult {
  const finalConfig = buildSubmitConfig()
  authErrors.value = validateAuth(finalConfig)

  if (finalConfig.mode === 'pages') {
    validatePageUrls()
    if (!finalConfig.pages.length) {
      activeTab.value = 'scope'
      return { ok: false, message: 'Enter at least one URL to scan.', color: 'warning' }
    }
    if (invalidPageLines.value.length) {
      activeTab.value = 'scope'
      return { ok: false, message: 'Fix highlighted URLs before starting.', color: 'error' }
    }
  }

  if (authErrors.value.length) {
    activeTab.value = 'auth'
    return { ok: false, message: 'Fix authentication settings before starting.', color: 'error' }
  }

  return { ok: true, config: finalConfig }
}

defineExpose({
  resetForm,
  buildSubmitConfig,
  validateForSubmit,
  validatePageUrls
})
</script>

<template>
  <div class="space-y-4">
    <UTabs
      v-model="activeTab"
      :content="false"
      :items="tabItems"
      color="neutral"
      size="sm"
      class="w-full"
    />
    <p class="text-sm text-muted">{{ tabSummary }}</p>

    <div v-show="activeTab === 'scope'" class="space-y-5">
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
            <UFormField label="Page limit" help="Scan stops after this many pages" class="w-full">
              <UInput v-model.number="configState.maxPages" class="w-full" type="number" min="1" />
            </UFormField>
            <UFormField label="Max depth" help="How many links deep to follow from the homepage" class="w-full">
              <UInput v-model.number="configState.maxDepth" class="w-full" type="number" min="1" />
            </UFormField>
          </div>
          <UFormField label="Stay on this domain" help="Don't follow links to external domains">
            <USwitch v-model="configState.stayOnDomain" />
          </UFormField>
          <UFormField label="Respect robots.txt" help="Skip pages disallowed by robots.txt">
            <USwitch v-model="configState.respectRobots" />
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

    <div v-show="activeTab === 'browser'" class="space-y-4">
        <UFormField label="Viewport" help="Viewport affects responsive layouts and may change which issues are detected">
          <URadioGroup v-model="configState.viewport" :items="viewportItems" orientation="horizontal" variant="table" />
        </UFormField>
        <UFormField
          label="Wait for page load"
          help="How long Playwright waits before running axe. Load is fast; Network idle or a delay helps when footer/SPA scripts fix contrast or ARIA after the load event."
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

    <div v-show="activeTab === 'auth'" class="space-y-4">
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

    <div v-show="activeTab === 'advanced'" class="space-y-4">
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
  </div>
</template>
