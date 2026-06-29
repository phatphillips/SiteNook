<script setup lang="ts">
import type { Site } from '~/types/accessiq'
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
const accordionOpen = ref<string | string[]>(['accessibility'])
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

const issueTypeItems = [
  { label: 'Issues', value: 'includeIssues', icon: 'i-lucide-circle-alert', iconClass: 'text-error' },
  { label: 'Potential issues', value: 'includePotentialIssues', icon: 'i-lucide-triangle-alert', iconClass: 'text-warning' }
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

const accordionItems = computed(() => [
  {
    label: `Accessibility  ›  ${accessibilityTargetSummary(settingsState)}`,
    value: 'accessibility',
    slot: 'accessibility' as const
  },
  {
    label: `Quality Assurance  ›  ${qaTargetSummary(settingsState)}`,
    value: 'qa',
    slot: 'qa' as const
  },
  {
    label: `SEO  ›  ${seoTargetSummary(settingsState)}`,
    value: 'seo',
    slot: 'seo' as const
  },
  {
    label: `Notifications  ›  ${notificationsTargetSummary(settingsState)}`,
    value: 'notifications',
    slot: 'notifications' as const
  }
])

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
    accordionOpen.value = ['accessibility']
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
    :ui="{ content: 'sm:max-w-3xl', description: 'text-muted' }"
  >
    <template v-if="resolvedSite" #body>
      <div class="space-y-6 max-h-[70vh] scroll-region">
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

        <UAccordion
          v-model="accordionOpen"
          type="multiple"
          :items="accordionItems"
          :unmount-on-hide="false"
          class="space-y-1"
        >
          <template #accessibility-body>
            <div class="space-y-5 pt-2">
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
          </template>

          <template #qa-body>
            <div class="space-y-4 pt-2">
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
          </template>

          <template #seo-body>
            <div class="space-y-4 pt-2">
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
          </template>

          <template #notifications-body>
            <div class="space-y-4 pt-2">
              <UFormField label="Email on completion">
                <USwitch v-model="notifyEnabled" />
              </UFormField>
              <UFormField v-if="notifyEnabled" label="Email address">
                <UInput v-model="settingsState.notifyEmail" type="email" />
              </UFormField>
              <UFormField label="Show diff from last scan">
                <USwitch v-model="settingsState.diffFromPrevious" />
              </UFormField>
            </div>
          </template>
        </UAccordion>
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

<style scoped>
.site-target-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  height: 18px;
  padding: 0 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 700;
  line-height: 1;
  color: #fff;
}

.site-target-badge--a {
  background: #c2185b;
}

.site-target-badge--aa {
  background: #7b1fa2;
}

.site-target-badge--aaa {
  background: linear-gradient(135deg, #3949ab, #7b1fa2);
}

.site-target-badge--aria {
  background: #1565c0;
}

.site-target-badge--bp {
  background: #0d47a1;
}
</style>
