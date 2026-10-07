<script setup lang="ts">
import type { ApiKeyScope } from '~/composables/useApiKeys'
import { formatPbClientError } from '~/utils/pbClientError'

const props = defineProps<{
  canManage: boolean
}>()

const toast = useToast()
const { keys, loading, creating, fetchKeys, createKey, revokeKey } = useApiKeys()

const name = ref('Cursor MCP')
const writeEnabled = ref(true)
const createdPlaintext = ref('')
const showCreated = ref(false)
const revokeId = ref<string | null>(null)
const revoking = ref(false)

const mcpConfigSnippet = computed(() => {
  const keyPlaceholder = createdPlaintext.value || 'ak_YOUR_KEY_HERE'
  return JSON.stringify({
    mcpServers: {
      sitenook: {
        command: 'npx',
        args: ['tsx', 'apps/mcp/src/index.ts'],
        env: {
          SITENOOK_URL: 'http://localhost:3500',
          SITENOOK_API_KEY: keyPlaceholder
        }
      }
    }
  }, null, 2)
})

const activeKeys = computed(() => keys.value.filter(k => !k.revoked_at))
const revokedKeys = computed(() => keys.value.filter(k => k.revoked_at))

async function refresh() {
  if (!props.canManage) return
  try {
    await fetchKeys()
  } catch (err) {
    toast.add({ title: 'Could not load API keys', description: formatPbClientError(err), color: 'error' })
  }
}

async function onCreate() {
  if (!props.canManage) return
  const scopes: ApiKeyScope[] = writeEnabled.value ? ['read', 'write'] : ['read']
  try {
    const result = await createKey(name.value.trim() || 'MCP key', scopes)
    createdPlaintext.value = result.key
    showCreated.value = true
    toast.add({ title: 'API key created', description: 'Copy it now. It will not be shown again.', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Could not create key', description: formatPbClientError(err), color: 'error' })
  }
}

async function confirmRevoke() {
  if (!revokeId.value) return
  revoking.value = true
  try {
    await revokeKey(revokeId.value)
    toast.add({ title: 'API key revoked', color: 'success' })
    revokeId.value = null
  } catch (err) {
    toast.add({ title: 'Could not revoke key', description: formatPbClientError(err), color: 'error' })
  } finally {
    revoking.value = false
  }
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.add({ title: `${label} copied`, color: 'success' })
  } catch {
    toast.add({ title: 'Copy failed', color: 'error' })
  }
}

function onRevokeModalOpen(open: boolean) {
  if (!open) revokeId.value = null
}

watch(() => props.canManage, (ok) => {
  if (ok) void refresh()
}, { immediate: true })
</script>

<template>
  <section class="rounded-lg border border-default bg-elevated/20 p-4 sm:p-5 space-y-4">
    <div>
      <h2 class="font-semibold mb-1">
        MCP / API keys
      </h2>
      <p class="text-sm text-muted max-w-2xl">
        Optional. Create a key so Cursor (or another MCP client) can list sites, read issues, and enqueue scans.
        The dashboard works fine without this. Only enable it if you want agent access.
      </p>
    </div>

    <div
      v-if="!canManage"
      class="text-sm text-muted"
    >
      Only organization admins can create or revoke API keys.
    </div>

    <template v-else>
      <div class="flex flex-col sm:flex-row gap-3 sm:items-end">
        <UFormField
          label="Key name"
          class="flex-1"
        >
          <UInput
            v-model="name"
            placeholder="Cursor MCP"
          />
        </UFormField>
        <UCheckbox
          v-model="writeEnabled"
          label="Allow write (enqueue scans, update QA)"
        />
        <UButton
          :loading="creating"
          @click="onCreate"
        >
          Create key
        </UButton>
      </div>

      <UAlert
        v-if="showCreated && createdPlaintext"
        color="warning"
        variant="subtle"
        title="Copy your API key now"
      >
        <template #description>
          <p class="mb-2">
            This is the only time the full key is shown.
          </p>
          <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <code class="text-xs break-all bg-default/60 px-2 py-1 rounded flex-1">{{ createdPlaintext }}</code>
            <UButton
              size="sm"
              color="neutral"
              variant="outline"
              @click="copyText(createdPlaintext, 'API key')"
            >
              Copy key
            </UButton>
          </div>
        </template>
      </UAlert>

      <div>
        <h3 class="text-sm font-medium mb-2">
          Cursor MCP config example
        </h3>
        <p class="text-xs text-muted mb-2">
          From the repo root, after <code class="text-xs">cd apps/mcp && npm install</code>.
          Docker override Nuxt URL is usually <code class="text-xs">http://localhost:3500</code>.
        </p>
        <pre class="text-xs bg-default/60 border border-default rounded p-3 overflow-x-auto">{{ mcpConfigSnippet }}</pre>
        <UButton
          class="mt-2"
          size="sm"
          color="neutral"
          variant="outline"
          @click="copyText(mcpConfigSnippet, 'Config')"
        >
          Copy config
        </UButton>
      </div>

      <div v-if="loading && !keys.length" class="text-sm text-muted">
        Loading keys…
      </div>

      <div v-else-if="activeKeys.length" class="space-y-2">
        <h3 class="text-sm font-medium">
          Active keys
        </h3>
        <ul class="divide-y divide-default border border-default rounded-lg">
          <li
            v-for="key in activeKeys"
            :key="key.id"
            class="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm"
          >
            <div>
              <div class="font-medium">
                {{ key.name }}
              </div>
              <div class="text-xs text-muted">
                {{ key.key_prefix }}… · scopes: {{ key.scopes.join(', ') }}
                <span v-if="key.last_used_at"> · last used {{ key.last_used_at }}</span>
              </div>
            </div>
            <UButton
              size="sm"
              color="error"
              variant="ghost"
              @click="revokeId = key.id"
            >
              Revoke
            </UButton>
          </li>
        </ul>
      </div>

      <p
        v-else
        class="text-sm text-muted"
      >
        No active API keys yet.
      </p>

      <p
        v-if="revokedKeys.length"
        class="text-xs text-muted"
      >
        {{ revokedKeys.length }} revoked key(s) retained for audit.
      </p>
    </template>

    <UModal
      :open="Boolean(revokeId)"
      :ui="{ content: 'sm:max-w-md' }"
      @update:open="onRevokeModalOpen"
    >
      <template #content>
        <div class="p-4 sm:p-6 space-y-4">
          <h2 class="font-semibold text-lg">
            Revoke API key?
          </h2>
          <p class="text-sm text-muted">
            Agents using this key will lose access immediately. You can create a new key anytime.
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="revokeId = null"
            >
              Cancel
            </UButton>
            <UButton
              color="error"
              :loading="revoking"
              @click="confirmRevoke"
            >
              Revoke
            </UButton>
          </div>
        </div>
      </template>
    </UModal>
  </section>
</template>
