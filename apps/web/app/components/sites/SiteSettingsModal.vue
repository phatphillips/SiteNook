<script setup lang="ts">
import type { Site } from '~/types/sitenook'
import {
  type SiteSettings,
  accessibilityTargetSummary,
  getDefaultSiteSettings,
  notificationsTargetSummary,
  parseSiteSettings,
  qaTargetSummary,
  serializeSiteSettings
} from '~/utils/siteSettings'
import { seoTargetSummary } from '~/utils/seoRules'
import { getSiteHostname, isValidHttpUrl } from '~/utils/scanConfig'

type SettingsTab = 'accessibility' | 'qa' | 'seo' | 'notifications'

const props = defineProps<{
  site: Site | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  saved: []
  deleted: []
  scanned: []
}>()

const { user } = usePocketBase()
const { sites, refreshSite, updateSite, deleteSites, queueDefaultScan } = useSites()
const { isSiteBusy } = useScans()
const toast = useToast()

const name = ref('')
const url = ref('')
const settingsState = reactive<SiteSettings>(getDefaultSiteSettings())
const activeTab = ref<SettingsTab>('accessibility')
const saving = ref(false)
const scanning = ref(false)
const showDeleteConfirm = ref(false)
const deleting = ref(false)
const formError = ref('')

const wcagVersionItems = [
  { label: 'WCAG 2.2', value: '2.2' },
  { label: 'WCAG 2.1', value: '2.1' },
  { label: 'WCAG 2.0', value: '2.0' }
]

const wcagConformanceItems = [
  { label: 'Level A', value: 'A', badge: 'A', badgeClass: 'site-target-badge site-target-badge--a' },
  { label: 'Level AA', value: 'AA', badge: 'AA', badgeClass: 'site-target-badge site-target-badge--aa' },
  { label: 'Level AAA', value: 'AAA', badge: 'AAA', badgeClass: 'site-target-badge site-target-badge--aaa' }
]

const spellLanguageItems = [
  { label: 'English (AU)', value: 'en-AU' },
  { label: 'English (US)', value: 'en-US' },
  { label: 'English (UK)', value: 'en-GB' },
  { label: 'French', value: 'fr' },
  { label: 'German', value: 'de' },
  { label: 'Spanish', value: 'es' }
]

const resolvedSite = computed(() => {
  if (!props.site) return null
  return sites.value.find(s => s.id === props.site!.id) ?? props.site
})

const hostname = computed(() => (resolvedSite.value ? getSiteHostname(resolvedSite.value.url) : ''))

const notifyEnabled = computed({
  get: () => settingsState.notifyEmail !== null && settingsState.notifyEmail !== '',
  set: (enabled: boolean) => {
    settingsState.notifyEmail = enabled ? String(user.value?.email || '') : null
  }
})

const tabItems = [
  { label: 'Accessibility', value: 'accessibility' as const, icon: 'i-lucide-accessibility' },
  { label: 'Quality Assurance', value: 'qa' as const, icon: 'i-lucide-shield-check' },
  { label: 'SEO', value: 'seo' as const, icon: 'i-lucide-search' },
  { label: 'Notifications', value: 'notifications' as const, icon: 'i-lucide-bell' }
]

const tabSummary = computed(() => {
  switch (activeTab.value) {
    case 'accessibility':
      return accessibilityTargetSummary(settingsState)
    case 'qa':
      return qaTargetSummary(settingsState)
    case 'seo':
      return seoTargetSummary(settingsState)
    case 'notifications':
      return notificationsTargetSummary(settingsState)
  }
})

function resetForm() {
  const site = resolvedSite.value
  if (!site) return
  name.value = site.name
  url.value = site.url
  Object.assign(settingsState, parseSiteSettings(site.site_settings, site.default_scan_config))
  formError.value = ''
}

watch(open, async (isOpen) => {
  const site = resolvedSite.value
  if (!isOpen || !site) return
  try {
    await refreshSite(site.id)
    resetForm()
    activeTab.value = 'accessibility'
  } catch (e: unknown) {
    formError.value = String(e)
  }
}, { flush: 'post' })

function validateBasics(): boolean {
  formError.value = ''
  if (!name.value.trim()) {
    formError.value = 'Site name is required.'
    return false
  }
  if (!isValidHttpUrl(url.value.trim())) {
    formError.value = 'Enter a valid URL (https://…).'
    return false
  }
  return true
}

async function save() {
  const site = resolvedSite.value
  if (!site || !validateBasics()) return

  saving.value = true
  try {
    await updateSite(site.id, {
      name: name.value.trim(),
      url: url.value.trim(),
      site_settings: serializeSiteSettings(settingsState)
    })
    toast.add({ title: 'Site settings saved', description: 'Reporting preferences updated for this site.' })
    emit('saved')
    open.value = false
  } catch (e: unknown) {
    toast.add({ title: 'Could not save', description: String(e), color: 'error' })
  } finally {
    saving.value = false
  }
}

async function scanNow() {
  const site = resolvedSite.value
  if (!site) return
  if (isSiteBusy(site.id)) {
    toast.add({
      title: 'Site busy',
      description: 'Wait for the current scan to finish or stop it from the Scans page.',
      color: 'warning'
    })
    return
  }

  scanning.value = true
  try {
    await queueDefaultScan(site.id)
    toast.add({ title: 'Scan queued', description: 'The scanner will begin shortly.' })
    emit('scanned')
  } catch (e: unknown) {
    toast.add({ title: 'Could not queue scan', description: String(e), color: 'error' })
  } finally {
    scanning.value = false
  }
}

async function confirmDelete() {
  const site = resolvedSite.value
  if (!site) return
  deleting.value = true
  try {
    await deleteSites([site.id])
    toast.add({ title: 'Site deleted', description: `${site.name} was removed.` })
    showDeleteConfirm.value = false
    open.value = false
    emit('deleted')
  } catch (e: unknown) {
    toast.add({ title: 'Could not delete site', description: String(e), color: 'error' })
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Site settings"
    :description="hostname"
    :ui="{
      content: 'sm:max-w-4xl',
      description: 'text-muted',
      body: 'min-h-[40rem] max-h-[min(44rem,calc(100dvh-10rem))] overflow-y-auto'
    }"
  >
    <template v-if="resolvedSite" #body>
      <div class="space-y-4">
        <p class="text-sm text-muted">
          Configure how this site appears in reports. The scanner always records every finding; these settings filter what counts toward your site target.
        </p>

        <div class="grid sm:grid-cols-2 gap-4">
          <UFormField label="Site name" required>
            <UInput v-model="name" required />
          </UFormField>
          <UFormField label="URL" required>
            <UInput v-model="url" type="url" placeholder="https://example.com" required />
          </UFormField>
        </div>

        <UAlert v-if="formError" color="error" variant="subtle" :title="formError" />

        <UTabs
          v-model="activeTab"
          :content="false"
          :items="tabItems"
          color="info"
          variant="link"
          size="md"
          class="w-full site-settings-tabs"
          :ui="{
            list: 'gap-1 border-b border-default pb-0',
            trigger: 'group relative grow gap-1.5 rounded-md px-2.5 py-1.5 font-medium text-muted transition-colors hover:bg-elevated/50 hover:text-highlighted data-[state=active]:text-info',
            leadingIcon: 'size-5 shrink-0 text-dimmed transition-colors group-hover:text-default group-data-[state=active]:text-info'
          }"
        />
        <p class="text-sm text-muted">{{ tabSummary }}</p>

        <div v-show="activeTab === 'accessibility'" class="space-y-5">
          <UFormField label="WCAG version">
            <URadioGroup
              v-model="settingsState.wcagVersion"
              :items="wcagVersionItems"
              orientation="horizontal"
              variant="table"
            />
          </UFormField>

          <UFormField label="WCAG conformance">
            <URadioGroup
              v-model="settingsState.wcagConformance"
              :items="wcagConformanceItems.map(item => ({ label: item.label, value: item.value }))"
              orientation="horizontal"
              variant="table"
            />
            <div class="flex flex-wrap gap-2 mt-2">
              <span
                v-for="item in wcagConformanceItems"
                :key="item.value"
                :class="item.badgeClass"
              >{{ item.badge }}</span>
            </div>
          </UFormField>

          <UFormField label="ARIA conformance">
            <UCheckbox
              v-model="settingsState.ariaConformance"
              label="WAI-ARIA authoring practices"
            >
              <template #label>
                <span class="inline-flex items-center gap-2">
                  WAI-ARIA authoring practices
                  <span class="site-target-badge site-target-badge--aria">ARIA</span>
                </span>
              </template>
            </UCheckbox>
          </UFormField>

          <UFormField label="Best practices">
            <UCheckbox v-model="settingsState.bestPractices">
              <template #label>
                <span class="inline-flex items-center gap-2">
                  Accessibility best practices
                  <span class="site-target-badge site-target-badge--bp">S</span>
                </span>
              </template>
            </UCheckbox>
          </UFormField>

          <UFormField label="Page depth weighting">
            <UCheckbox
              v-model="settingsState.depthWeightedScoring"
              label="Weight shallow pages more heavily in scores"
            />
            <p class="text-xs text-muted mt-1">
              When enabled, homepage and top-level pages influence the accessibility and QA scores more than deep pages.
            </p>
          </UFormField>

          <UFormField label="Issue type">
            <div class="flex flex-wrap gap-4">
              <UCheckbox v-model="settingsState.includeIssues">
                <template #label>
                  <span class="inline-flex items-center gap-2">
                    <UIcon name="i-lucide-circle-alert" class="size-4 text-error" />
                    Issues
                  </span>
                </template>
              </UCheckbox>
              <UCheckbox v-model="settingsState.includePotentialIssues">
                <template #label>
                  <span class="inline-flex items-center gap-2">
                    <UIcon name="i-lucide-triangle-alert" class="size-4 text-warning" />
                    Potential issues
                  </span>
                </template>
              </UCheckbox>
            </div>
          </UFormField>
        </div>

        <div v-show="activeTab === 'qa'" class="space-y-4">
          <UFormField label="Check broken links">
            <USwitch v-model="settingsState.checkLinks" />
          </UFormField>
          <UFormField label="Spell check">
            <USwitch v-model="settingsState.checkSpelling" />
          </UFormField>
          <UFormField v-if="settingsState.checkSpelling" label="Language">
            <USelectMenu v-model="settingsState.spellLanguage" :items="spellLanguageItems" value-key="value" />
          </UFormField>
          <UFormField label="Readability scoring">
            <USwitch v-model="settingsState.checkReadability" />
          </UFormField>
          <UFormField label="Run custom policies">
            <USwitch v-model="settingsState.runPolicies" />
          </UFormField>
        </div>

        <div v-show="activeTab === 'seo'" class="space-y-4">
          <UFormField label="SEO checks">
            <USwitch v-model="settingsState.checkSeo" />
          </UFormField>
          <UFormField label="Structured data checks">
            <USwitch v-model="settingsState.checkStructuredData" :disabled="!settingsState.checkSeo" />
          </UFormField>
          <div class="grid sm:grid-cols-2 gap-4">
            <UFormField label="Title min length">
              <UInput v-model.number="settingsState.seoTitleMinLength" type="number" min="10" max="80" />
            </UFormField>
            <UFormField label="Title max length">
              <UInput v-model.number="settingsState.seoTitleMaxLength" type="number" min="40" max="120" />
            </UFormField>
            <UFormField label="Description min length">
              <UInput v-model.number="settingsState.seoDescMinLength" type="number" min="50" max="200" />
            </UFormField>
            <UFormField label="Description max length">
              <UInput v-model.number="settingsState.seoDescMaxLength" type="number" min="120" max="320" />
            </UFormField>
            <UFormField label="Thin content threshold (words)">
              <UInput v-model.number="settingsState.thinContentWordThreshold" type="number" min="100" max="2000" />
            </UFormField>
          </div>
        </div>

        <div v-show="activeTab === 'notifications'" class="space-y-4">
          <UFormField label="Email on completion">
            <USwitch v-model="notifyEnabled" />
          </UFormField>
          <UFormField v-if="notifyEnabled" label="Email address">
            <UInput
              :model-value="settingsState.notifyEmail ?? ''"
              type="email"
              @update:model-value="settingsState.notifyEmail = String($event || '')"
            />
          </UFormField>
          <UFormField label="Show diff from last scan">
            <USwitch v-model="settingsState.diffFromPrevious" />
          </UFormField>
        </div>
      </div>
    </template>

    <template v-if="resolvedSite" #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <UButton
          label="Delete site"
          color="error"
          variant="outline"
          icon="i-lucide-trash-2"
          @click="showDeleteConfirm = true"
        />
        <div class="flex flex-wrap gap-2 justify-end">
          <UButton
            label="Scan"
            color="neutral"
            variant="outline"
            icon="i-lucide-radar"
            :loading="scanning"
            :disabled="isSiteBusy(resolvedSite.id)"
            @click="scanNow"
          />
          <UButton
            label="Save"
            icon="i-lucide-save"
            :loading="saving"
            @click="save"
          />
        </div>
      </div>
    </template>
  </UModal>

  <UModal
    v-model:open="showDeleteConfirm"
    title="Delete site"
    :description="`Permanently remove ${site?.name ?? 'this site'} and all related scans and issues?`"
  >
    <template #body>
      <div class="flex justify-end gap-2">
        <UButton label="Cancel" color="neutral" variant="subtle" @click="showDeleteConfirm = false" />
        <UButton
          label="Delete"
          color="error"
          icon="i-lucide-trash-2"
          :loading="deleting"
          @click="confirmDelete"
        />
      </div>
    </template>
  </UModal>
</template>

