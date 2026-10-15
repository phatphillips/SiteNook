<script setup lang="ts">
import type { Site } from '~/types/sitenook'
import type { ReadabilityMethodId } from '~/utils/readabilityMethods'
import {
  READABILITY_METHODS,
  DEFAULT_READABILITY_METHODS,
  coerceReadabilityMethods
} from '~/utils/readabilityMethods'
import { parseSiteSettings } from '~/utils/siteSettings'

const props = withDefaults(defineProps<{
  site: Site | null
  /** When true, selection is stored locally (org all-sites view) instead of saving to a site. */
  localOnly?: boolean
  methods?: ReadabilityMethodId[]
  /** Apply the chosen method to every site in the organization. Default true. */
  applyToAllSites?: boolean
}>(), {
  localOnly: false,
  methods: undefined,
  applyToAllSites: true
})

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  saved: []
  'update:methods': [ReadabilityMethodId[]]
}>()

const toast = useToast()
const { sites, saveSiteSettings } = useSites()
const saving = ref(false)
const draftMethod = ref<ReadabilityMethodId>(DEFAULT_READABILITY_METHODS[0])
const referenceOpen = ref<string[]>([])

watch(open, (isOpen) => {
  if (!isOpen) return
  if (props.localOnly) {
    const primary = coerceReadabilityMethods(props.methods ?? DEFAULT_READABILITY_METHODS)[0]
      ?? DEFAULT_READABILITY_METHODS[0]
    draftMethod.value = primary
    referenceOpen.value = []
    return
  }
  if (!props.site) return
  const settings = parseSiteSettings(props.site.site_settings, props.site.default_scan_config)
  const primary = coerceReadabilityMethods(settings.readabilityMethods)[0]
    ?? DEFAULT_READABILITY_METHODS[0]
  draftMethod.value = primary
  referenceOpen.value = []
})

async function saveMethodToSites(methodId: ReadabilityMethodId) {
  const targets = (props.applyToAllSites
    ? sites.value
    : props.site
      ? [props.site]
      : []
  ).filter(Boolean)

  if (!targets.length) {
    throw new Error('No sites available to update')
  }

  await Promise.all(targets.map(async (site) => {
    const current = parseSiteSettings(site.site_settings, site.default_scan_config)
    const existing = (site.site_settings && typeof site.site_settings === 'object')
      ? { ...(site.site_settings as Record<string, unknown>) }
      : {}
    await saveSiteSettings(site.id, {
      ...existing,
      ...current,
      readabilityMethods: [methodId]
    })
  }))
}

async function save() {
  if (props.localOnly) {
    emit('update:methods', [draftMethod.value])
    if (props.applyToAllSites && sites.value.length) {
      saving.value = true
      try {
        await saveMethodToSites(draftMethod.value)
        open.value = false
        emit('saved')
        toast.add({
          title: 'Readability method updated for all sites',
          color: 'success'
        })
      } catch (err) {
        toast.add({
          title: 'Could not save readability method',
          description: err instanceof Error ? err.message : undefined,
          color: 'error'
        })
      } finally {
        saving.value = false
      }
      return
    }
    open.value = false
    emit('saved')
    return
  }

  if (!props.site && !props.applyToAllSites) return

  saving.value = true
  try {
    await saveMethodToSites(draftMethod.value)
    open.value = false
    emit('saved')
    toast.add({
      title: props.applyToAllSites
        ? 'Readability method updated for all sites'
        : 'Readability method updated',
      color: 'success'
    })
  } catch (err) {
    toast.add({
      title: 'Could not save readability method',
      description: err instanceof Error ? err.message : undefined,
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    title="Readability scoring method"
    :ui="{ content: 'max-w-3xl' }"
  >
    <template #body>
      <div class="max-h-[70vh] overflow-y-auto space-y-6 pr-1">
        <p class="text-sm text-muted">
          Choose one readability test. The scanner still computes all methods on each crawl; this setting controls which score is shown on Readability pages
          <template v-if="applyToAllSites"> and is applied to every site in your organization</template>.
        </p>

        <div class="space-y-2">
            <label
              v-for="method in READABILITY_METHODS"
              :key="method.id"
              class="flex items-start gap-3 rounded-lg border border-default px-3 py-2.5 cursor-pointer hover:bg-elevated/50"
              :class="draftMethod === method.id ? 'border-primary/40 bg-primary/5' : ''"
            >
              <input
                v-model="draftMethod"
                type="radio"
                name="readability-method"
                class="mt-1 size-4 accent-primary"
                :value="method.id"
              >
              <span class="min-w-0 flex-1">
                <span class="inline-flex items-center gap-2 text-sm font-medium">
                  <span class="readability-badge" :class="method.badgeClass">{{ method.badge }}</span>
                  {{ method.label }}
                </span>
                <span class="block text-xs text-muted mt-0.5">{{ method.scale }}</span>
              </span>
            </label>
          </div>

        <UAccordion
          v-model="referenceOpen"
          type="multiple"
          :items="[{ label: 'Readability test reference', value: 'reference', slot: 'reference' }]"
          :ui="{ item: 'border border-default rounded-lg bg-elevated px-4' }"
        >
          <template #reference-body>
            <p class="text-sm text-muted mb-4">
              Summaries of all seven Siteimprove-style readability methods.
            </p>
            <AccessibilityReadabilityMethodReferenceGrid
              :enabled-methods="[draftMethod]"
              compact
            />
          </template>
        </UAccordion>
      </div>
    </template>
    <template #footer>
      <div class="flex justify-end gap-2">
        <UButton color="neutral" variant="outline" label="Cancel" @click="open = false" />
        <UButton label="Save" :loading="saving" @click="save" />
      </div>
    </template>
  </UModal>
</template>
