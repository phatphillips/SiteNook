<script setup lang="ts">
import type { ApplianceLicenceStatusDto } from '~/types/applianceLicence'
import { formatPbClientError } from '~/utils/pbClientError'

const { pb } = usePocketBase()
const toast = useToast()
const config = useRuntimeConfig()

const status = ref<ApplianceLicenceStatusDto | null>(null)
const loading = ref(true)
const saving = ref(false)
const keyInput = ref('')

const checkoutUrl = computed(() =>
  String(status.value?.checkoutUrl || config.public.polarCheckoutUrl || '').trim()
)

async function loadStatus() {
  loading.value = true
  try {
    status.value = await $fetch<ApplianceLicenceStatusDto>('/api/licence/status')
  } catch {
    status.value = null
  } finally {
    loading.value = false
  }
}

async function activate() {
  if (!pb?.authStore.token) return
  saving.value = true
  try {
    status.value = await $fetch<ApplianceLicenceStatusDto>('/api/licence/activate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pb.authStore.token}` },
      body: { key: keyInput.value.trim() }
    })
    keyInput.value = ''
    toast.add({
      title: 'Licence activated',
      description: 'Full self-host limits are now unlocked on this install.',
      color: 'success'
    })
  } catch (error) {
    toast.add({
      title: 'Could not activate licence',
      description: formatPbClientError(error),
      color: 'error'
    })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  void loadStatus()
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="space-y-1">
        <h2 class="text-base font-semibold text-highlighted">
          Self-host licence
        </h2>
        <p class="text-sm text-muted">
          Free installs allow 1 site and 20 pages per scan. A Polar licence key unlocks full local limits.
          Scanning runs on this machine. There is no SiteNook cloud scan API.
        </p>
      </div>
    </template>

    <div
      v-if="loading"
      class="flex justify-center py-8"
    >
      <UIcon
        name="i-lucide-loader-circle"
        class="size-6 animate-spin text-muted"
      />
    </div>

    <div
      v-else
      class="space-y-4"
    >
      <p class="text-sm text-default">
        {{ status?.message || 'Community edition' }}
      </p>
      <p
        v-if="status?.keyHint"
        class="text-sm text-muted"
      >
        Current key: {{ status.keyHint }}
      </p>
      <p
        v-if="status && !status.polarConfigured"
        class="text-sm text-warning"
      >
        Polar organization ID is missing. Add
        <code class="text-xs">SITENOOK_POLAR_ORGANIZATION_ID</code>
        to your <code class="text-xs">.env</code>
        (Polar dashboard → Settings → Organization ID), then restart Docker.
      </p>

      <form
        class="flex flex-col gap-3 sm:flex-row sm:items-end"
        @submit.prevent="activate"
      >
        <UFormField
          label="Licence key"
          class="flex-1"
        >
          <UInput
            v-model="keyInput"
            placeholder="AIQ_…"
            autocomplete="off"
          />
        </UFormField>
        <UButton
          type="submit"
          color="primary"
          :loading="saving"
          :disabled="!keyInput.trim() || status?.polarConfigured === false"
        >
          Activate
        </UButton>
      </form>

      <UButton
        v-if="checkoutUrl"
        :to="checkoutUrl"
        external
        target="_blank"
        variant="outline"
        icon="i-lucide-external-link"
      >
        Buy a licence
      </UButton>
    </div>
  </UCard>
</template>
