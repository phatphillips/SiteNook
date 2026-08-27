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
const { markSiteAndScanStarted, onboardingState } = useOnboarding()
const toast = useToast()
const router = useRouter()
const config = useRuntimeConfig()
const showAha = ref(false)

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
    await markSiteAndScanStarted()
    toast.add({
      title: 'Site created',
      description: 'Your first scan has been queued. We’ll show what matters most when you are ready.'
    })
    open.value = false
    if (!onboardingState.value.ahaSeen) {
      showAha.value = true
    } else {
      await router.push('/scans')
    }
  } catch (e: unknown) {
    const msg = e && typeof e === 'object' && 'message' in e
      ? String((e as { message: string }).message)
      : 'Could not create site.'
    error.value = msg.includes('Session expired') ? msg : 'Could not create site. Try again.'
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
    :ui="{ content: step === 2 ? 'sm:max-w-4xl' : 'sm:max-w-lg' }"
  >
    <template #body>
      <form v-if="step === 1" class="space-y-4" @submit.prevent="goToStep2">
        <UFormField label="Title" required>
          <UInput v-model="siteInfo.name" required />
        </UFormField>
        <UFormField label="URL" required>
          <UInput v-model="siteInfo.url" type="url" placeholder="https://example.com" required />
        </UFormField>
        <UFormField label="Description">
          <UTextarea v-model="siteInfo.description" />
        </UFormField>
        <p class="text-sm text-muted">
          After adding site details, you will configure the first scan. Scans repeat automatically every 5 days.
        </p>
        <UAlert v-if="error" color="error" variant="subtle" :title="error" />
      </form>

      <ScanConfigForm
        v-else-if="draftScanConfig"
        ref="formRef"
        :site-url="siteInfo.url.trim()"
        :initial-raw-config="draftScanConfig"
        :max-pages-default="maxPagesDefault"
      />

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
  <OnboardingAhaModal
    v-model:open="showAha"
    :issue-count="0"
    @continue="router.push('/accessibility/issues')"
    @invite="router.push('/settings/users')"
  />
</template>
