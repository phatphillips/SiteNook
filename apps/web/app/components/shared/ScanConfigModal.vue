<script setup lang="ts">
import type { Site } from '~/types/sitenook'
import {
  deriveScanType,
  getSiteHostname,
  serializeScanConfig
} from '~/utils/scanConfig'
import type ScanConfigForm from '~/components/shared/ScanConfigForm.vue'

const props = defineProps<{
  site: Site | null
  initialPageUrl?: string
  initialRawConfig?: Record<string, unknown> | null
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  queued: []
}>()

const { queueScanWithConfig, saveDefaultScanConfig } = useSites()
const { isSiteBusy } = useScans()
const toast = useToast()
const config = useRuntimeConfig()

const maxPagesDefault = Number(config.public.maxPagesPerScan || 500)
const submitting = ref(false)
const formRef = useTemplateRef<InstanceType<typeof ScanConfigForm>>('formRef')

const hostname = computed(() => (props.site ? getSiteHostname(props.site.url) : ''))

watch(open, (isOpen) => {
  if (isOpen) {
    nextTick(() => formRef.value?.resetForm())
  }
})

async function saveAsDefault() {
  if (!props.site || !formRef.value) return
  const payload = serializeScanConfig(formRef.value.buildSubmitConfig())
  try {
    await saveDefaultScanConfig(props.site.id, payload)
    toast.add({ title: 'Default saved', description: 'This configuration will pre-fill next time.' })
  } catch (e: unknown) {
    toast.add({ title: 'Could not save default', description: String(e), color: 'error' })
  }
}

async function submit() {
  if (!props.site || !formRef.value) return

  const validation = formRef.value.validateForSubmit()
  if (!validation.ok) {
    toast.add({
      title: validation.color === 'warning' ? 'Add URLs' : 'Invalid configuration',
      description: validation.message,
      color: validation.color ?? 'error'
    })
    return
  }

  if (validation.config.mode === 'sitemap' && formRef.value) {
    toast.add({
      title: 'Sitemap not verified',
      description: 'Consider fetching the sitemap preview first. You can still continue.',
      color: 'warning'
    })
  }

  submitting.value = true
  try {
    if (isSiteBusy(props.site.id)) {
      toast.add({
        title: 'Site busy',
        description: 'Wait for the current scan to finish or stop it from the Scans page.',
        color: 'warning'
      })
      return
    }

    const raw = serializeScanConfig(validation.config)
    await queueScanWithConfig(props.site.id, raw, deriveScanType(validation.config))
    toast.add({ title: 'Scan queued', description: 'The scanner will begin shortly.' })
    emit('queued')
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
    :ui="{
      content: 'sm:max-w-4xl',
      description: 'text-muted',
      body: 'min-h-[32rem] max-h-[32rem] overflow-y-auto'
    }"
  >
    <template #body>
      <ScanConfigForm
        v-if="site"
        ref="formRef"
        :site-url="site.url"
        :initial-raw-config="initialRawConfig ?? site.default_scan_config"
        :initial-page-url="initialPageUrl"
        :max-pages-default="maxPagesDefault"
      />
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-between gap-3">
        <UButton label="Save as default" variant="link" color="neutral" size="sm" @click="saveAsDefault" />
        <div class="flex gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="open = false" />
          <UButton label="Start Scan" :loading="submitting" @click="submit" />
        </div>
      </div>
    </template>
  </UModal>
</template>
