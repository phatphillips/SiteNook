<script setup lang="ts">
import type { AnalyticsProvider, Site } from '~/types/sitenook'
import type { AnalyticsCredentialField } from '~/composables/useAnalyticsConnections'

const props = defineProps<{
  open: boolean
  provider: AnalyticsProvider
  providerName: string
  fields: AnalyticsCredentialField[]
  sites: Site[]
  initialSiteId?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  test: [payload: { siteId: string, credentials: Record<string, string> }]
  save: [payload: { siteId: string, credentials: Record<string, string> }]
}>()

const siteId = ref('')
const values = ref<Record<string, string>>({})
const testedOk = ref(false)
const testing = ref(false)
const saving = ref(false)
const fieldError = ref('')
const testSuccess = ref('')
const shake = ref(false)
const firstFieldRef = ref<HTMLElement | null>(null)

function normalizeSiteId(value: unknown): string {
  if (typeof value === 'string') return value.trim()
  if (value && typeof value === 'object' && 'value' in value) {
    return String((value as { value: unknown }).value ?? '').trim()
  }
  return ''
}

const resolvedSiteId = computed(() => normalizeSiteId(siteId.value))

watch(
  () => props.open,
  (isOpen) => {
    if (!isOpen) return
    siteId.value = props.initialSiteId || props.sites[0]?.id || ''
    values.value = Object.fromEntries(props.fields.map((f) => [f.key, '']))
    testedOk.value = false
    fieldError.value = ''
    testSuccess.value = ''
    nextTick(() => {
      firstFieldRef.value?.querySelector?.('input')?.focus?.()
    })
  }
)

watch([resolvedSiteId, values], () => {
  testedOk.value = false
  testSuccess.value = ''
}, { deep: true })

const requiredValid = computed(() => {
  if (!resolvedSiteId.value) return false
  return props.fields.every((f) => !f.required || String(values.value[f.key] || '').trim())
})

function flashError(message: string) {
  testSuccess.value = ''
  fieldError.value = message
  shake.value = true
  window.setTimeout(() => {
    shake.value = false
  }, 400)
}

async function onTest() {
  if (!requiredValid.value && props.fields.length > 0) {
    flashError('Fill in all required fields and choose a site.')
    return
  }
  if (!resolvedSiteId.value) {
    flashError('Choose an SiteNook site.')
    return
  }
  fieldError.value = ''
  testSuccess.value = ''
  emit('test', { siteId: resolvedSiteId.value, credentials: { ...values.value } })
}

function markTestResult(ok: boolean, error?: string) {
  testedOk.value = ok
  if (!ok) {
    flashError(error || 'Connection test failed')
    return
  }
  fieldError.value = ''
  testSuccess.value = `Connected successfully to ${props.providerName}. You can save this connection.`
}

async function onSave() {
  if (!testedOk.value) {
    flashError('Test the connection successfully before saving.')
    return
  }
  saving.value = true
  try {
    emit('save', { siteId: resolvedSiteId.value, credentials: { ...values.value } })
  } finally {
    saving.value = false
  }
}

defineExpose({
  markTestResult,
  setTesting: (v: boolean) => { testing.value = v },
  setSaving: (v: boolean) => { saving.value = v }
})
</script>

<template>
  <UModal
    :open="open"
    :ui="{ content: 'sm:max-w-lg' }"
    @update:open="emit('update:open', $event)"
  >
    <template #content>
      <div class="p-4 sm:p-6 space-y-4">
        <div>
          <h2 class="font-semibold text-lg">
            Connect {{ providerName }}
          </h2>
          <p class="text-sm text-muted mt-1">
            <template v-if="fields.length === 0">
              Choose an SiteNook site, then continue to Google to authorize Analytics access.
            </template>
            <template v-else>
              Choose an SiteNook site, then enter credentials. Test before saving. Secrets are encrypted and never shown again.
            </template>
          </p>
        </div>

        <UFormField
          label="SiteNook site"
          required
        >
          <USelectMenu
            v-model="siteId"
            value-key="value"
            :items="sites.map((s) => ({ label: s.name, value: s.id }))"
            class="w-full"
            placeholder="Select a site"
          />
        </UFormField>

        <div
          ref="firstFieldRef"
          class="space-y-3"
          :class="shake ? 'motion-safe:animate-[shake_0.35s_ease-in-out]' : ''"
        >
          <UFormField
            v-for="field in fields"
            :key="field.key"
            :label="field.label"
            :required="field.required"
            :help="field.help"
          >
            <UInput
              v-model="values[field.key]"
              :type="field.type === 'password' ? 'password' : 'text'"
              :placeholder="field.placeholder"
              class="w-full"
              autocomplete="off"
            />
          </UFormField>
        </div>

        <p
          v-if="fieldError"
          class="flex items-start gap-2 text-sm text-error"
          role="alert"
        >
          <UIcon
            name="i-lucide-circle-alert"
            class="size-4 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{{ fieldError }}</span>
        </p>

        <p
          v-else-if="testSuccess"
          class="flex items-start gap-2 text-sm text-success"
          role="status"
          aria-live="polite"
        >
          <UIcon
            name="i-lucide-check-circle-2"
            class="size-4 shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <span>{{ testSuccess }}</span>
        </p>

        <div class="flex flex-wrap justify-end gap-2 pt-2">
          <UButton
            color="neutral"
            variant="ghost"
            @click="emit('update:open', false)"
          >
            Cancel
          </UButton>
          <template v-if="fields.length === 0">
            <UButton
              color="neutral"
              :loading="testing"
              :disabled="!resolvedSiteId || testing"
              @click="onTest"
            >
              Continue with Google
            </UButton>
          </template>
          <template v-else>
            <UButton
              color="neutral"
              variant="outline"
              :loading="testing"
              :disabled="!requiredValid || testing"
              @click="onTest"
            >
              Test connection
            </UButton>
            <UButton
              color="neutral"
              :loading="saving"
              :disabled="!testedOk || saving"
              @click="onSave"
            >
              Save
            </UButton>
          </template>
        </div>
      </div>
    </template>
  </UModal>
</template>

<style scoped>
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  75% { transform: translateX(4px); }
}
</style>
