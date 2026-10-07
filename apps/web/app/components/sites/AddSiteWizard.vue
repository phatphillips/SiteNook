<script setup lang="ts">
import {
  deriveScanType,
  getBrowserTimezone,
  serializeScanConfig
} from '~/utils/scanConfig'
import { buildDefaultSiteScanConfig } from '~/utils/defaultSiteScan'
import type ScanConfigForm from '~/components/shared/ScanConfigForm.vue'

const open = defineModel<boolean>('open', { default: false })

const { createSiteAndQueueScan } = useSites()
const { markSiteAdded } = useOnboarding()
const toast = useToast()
const router = useRouter()
const config = useRuntimeConfig()

const step = ref<1 | 2>(1)
const submitting = ref(false)
const error = ref('')
const formRef = useTemplateRef<InstanceType<typeof ScanConfigForm>>('formRef')

const siteInfo = reactive({ name: '', url: '', description: '' })
const maxPagesDefault = Number(config.public.maxPagesPerScan || 500)

const draftScanConfig = computed(() =>
  siteInfo.url.trim()
    ? buildDefaultSiteScanConfig(siteInfo.url.trim(), getBrowserTimezone(), maxPagesDefault)
    : null
)

watch(open, (isOpen) => {
  if (isOpen) {
    step.value = 1
    error.value = ''
    siteInfo.name = ''
    siteInfo.url = ''
    siteInfo.description = ''
  }
})

function goToStep2() {
  error.value = ''
  const url = siteInfo.url.trim()
  if (!siteInfo.name.trim()) {
    error.value = 'Enter a site title.'
    return
  }
  if (!url) {
    error.value = 'Enter a site URL.'
    return
  }
  try {
    new URL(url)
  } catch {
    error.value = 'Enter a valid URL (https://…).'
    return
  }
  step.value = 2
}

async function startScan() {
  if (!formRef.value) return
  error.value = ''

  const validation = formRef.value.validateForSubmit()
  if (!validation.ok) {
    toast.add({
      title: validation.color === 'warning' ? 'Add URLs' : 'Invalid configuration',
      description: validation.message,
      color: validation.color ?? 'error'
    })
    return
  }

  submitting.value = true
  try {
    const raw = serializeScanConfig(validation.config)
    await createSiteAndQueueScan(
      {
        name: siteInfo.name.trim(),
        url: siteInfo.url.trim(),
        description: siteInfo.description.trim() || undefined
      },
      raw,
      deriveScanType(validation.config)
    )
    // Don't block success UX if milestone persistence fails (e.g. transient API error).
    await markSiteAdded().catch(() => {})
    toast.add({
      title: 'Scan queued',
      description: 'Your site was added and the first crawl is starting. Step 2 completes when the scan finishes.'
    })
    open.value = false
    await router.push('/scans')
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: string }).message)
      : 'Could not create site.'
    error.value = msg.includes('Session expired') || msg.includes('plan allows')
      ? msg
      : 'Could not create site. Try again.'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <UModal
    v-model:open="open"
    :title="step === 1 ? 'Add Site' : 'Configure Scan'"
    :description="step === 2 ? siteInfo.url : undefined"
    :ui="{
      content: 'sm:max-w-4xl',
      body: 'min-h-[32rem] max-h-[32rem] overflow-y-auto'
    }"
  >
    <template #body>
      <form v-if="step === 1" class="flex h-full min-h-full w-full flex-col gap-4" @submit.prevent="goToStep2">
        <UFormField label="Title" required class="w-full shrink-0">
          <UInput v-model="siteInfo.name" class="w-full" placeholder="Example" required />
        </UFormField>
        <UFormField label="URL" required class="w-full shrink-0">
          <UInput
            v-model="siteInfo.url"
            class="w-full"
            type="url"
            placeholder="https://example.com"
            required
          />
        </UFormField>
        <div class="flex min-h-0 w-full flex-1 flex-col gap-1.5">
          <label class="block text-sm font-medium text-default">Description</label>
          <UTextarea
            v-model="siteInfo.description"
            class="min-h-0 w-full flex-1"
            :rows="14"
            :ui="{ base: 'h-full min-h-[16rem] resize-none' }"
          />
        </div>
        <p class="shrink-0 text-sm text-muted">
          After adding site details, you will configure the first scan. Scans repeat automatically every 5 days.
        </p>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" class="shrink-0" />
      </form>

      <div v-else-if="draftScanConfig" class="w-full">
        <ScanConfigForm
          ref="formRef"
          :site-url="siteInfo.url.trim()"
          :initial-raw-config="draftScanConfig"
          :max-pages-default="maxPagesDefault"
        />
      </div>

      <UAlert v-if="step === 2 && error" color="error" variant="subtle" :title="error" class="mt-4" />
    </template>

    <template #footer>
      <div class="flex w-full justify-between gap-3">
        <UButton
          v-if="step === 2"
          label="Back"
          color="neutral"
          variant="outline"
          @click="step = 1"
        />
        <div v-else />

        <div class="flex gap-2">
          <UButton label="Cancel" color="neutral" variant="outline" @click="open = false" />
          <UButton
            v-if="step === 1"
            label="Next"
            @click="goToStep2"
          />
          <UButton
            v-else
            label="Start scan"
            :loading="submitting"
            @click="startScan"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
