<script setup lang="ts">
import type { AnalyticsConnection, AnalyticsProvider, Site } from '~/types/sitenook'
import { isOrgAdmin } from '~/utils/orgAccess'
import { formatPbClientError } from '~/utils/pbClientError'
import AnalyticsProviderCard from '~/components/settings/integrations/AnalyticsProviderCard.vue'
import AnalyticsCredentialConnectModal from '~/components/settings/integrations/AnalyticsCredentialConnectModal.vue'
import AnalyticsGa4PropertyPicker from '~/components/settings/integrations/AnalyticsGa4PropertyPicker.vue'
import McpApiKeysPanel from '~/components/settings/integrations/McpApiKeysPanel.vue'

definePageMeta({ middleware: 'auth' })

const { sessionUser, awaitAuthReady } = usePocketBase()
const { sites, fetchSites } = useSites()
const toast = useToast()
const route = useRoute()
const router = useRouter()

const {
  connections,
  providers,
  loading,
  fetchConnections,
  testConnection,
  saveConnection,
  disconnect,
  startGa4OAuth,
  listGa4Properties,
  setGa4Property,
  connectionsForProvider
} = useAnalyticsConnections()

const pageReady = ref(false)
const canManage = computed(() => pageReady.value && isOrgAdmin(sessionUser.value))
const liveMessage = ref('')
const highlightedProvider = ref<AnalyticsProvider | null>(null)
const cardLoading = ref<Partial<Record<AnalyticsProvider, boolean>>>({})

const modalOpen = ref(false)
const activeProvider = ref<AnalyticsProvider | null>(null)
const credentialModal = useTemplateRef('credentialModal')

const disconnectTarget = ref<AnalyticsConnection | null>(null)
const disconnectOpen = ref(false)
const disconnecting = ref(false)

const ga4PickerOpen = ref(false)
const ga4ConnectionId = ref('')
const ga4Properties = ref<Array<{ id: string, label: string }>>([])
const ga4Loading = ref(false)

const siteOptions = computed(() => (sites.value || []) as Site[])

const activeMeta = computed(() =>
  providers.value.find((p) => p.id === activeProvider.value) || null
)

function announce(message: string) {
  liveMessage.value = ''
  nextTick(() => {
    liveMessage.value = message
  })
}

function flashHighlight(provider: AnalyticsProvider) {
  highlightedProvider.value = provider
  window.setTimeout(() => {
    if (highlightedProvider.value === provider) highlightedProvider.value = null
  }, 1600)
}

async function refresh() {
  await fetchConnections()
}

async function onConnect(provider: AnalyticsProvider) {
  if (!canManage.value) return
  if (provider === 'ga4') {
    // Site picker via a minimal prompt: open credential modal shell only for site, then OAuth
    activeProvider.value = 'ga4'
    modalOpen.value = true
    return
  }
  activeProvider.value = provider
  modalOpen.value = true
}

async function beginGa4OAuth(siteId: string) {
  cardLoading.value.ga4 = true
  try {
    const url = await startGa4OAuth(siteId)
    window.location.href = url
  } catch (err) {
    toast.add({ title: 'Could not start Google sign-in', description: formatPbClientError(err), color: 'error' })
    cardLoading.value.ga4 = false
  }
}

async function onTest(payload: { siteId: string, credentials: Record<string, string> }) {
  if (!activeProvider.value) return
  if (activeProvider.value === 'ga4') {
    modalOpen.value = false
    await beginGa4OAuth(payload.siteId)
    return
  }
  credentialModal.value?.setTesting(true)
  try {
    const result = await testConnection(activeProvider.value, payload.credentials)
    credentialModal.value?.markTestResult(result.ok, result.error)
    if (result.ok) {
      const name = activeMeta.value?.name || 'Provider'
      announce(`${name} connection test passed`)
      toast.add({
        title: 'Connection test passed',
        description: `${name} credentials look valid. You can save this connection.`,
        color: 'success'
      })
    } else {
      toast.add({
        title: 'Connection test failed',
        description: result.error || 'Check your credentials and try again.',
        color: 'error'
      })
    }
  } catch (err) {
    const message = formatPbClientError(err)
    credentialModal.value?.markTestResult(false, message)
    toast.add({ title: 'Connection test failed', description: message, color: 'error' })
  } finally {
    credentialModal.value?.setTesting(false)
  }
}

async function onSave(payload: { siteId: string, credentials: Record<string, string> }) {
  if (!activeProvider.value || activeProvider.value === 'ga4') return
  const provider = activeProvider.value
  credentialModal.value?.setSaving(true)
  cardLoading.value[provider] = true
  try {
    await saveConnection({
      provider,
      siteId: payload.siteId,
      credentials: payload.credentials
    })
    modalOpen.value = false
    flashHighlight(provider)
    announce(`${activeMeta.value?.name || provider} connected`)
    toast.add({ title: 'Connected', description: `${activeMeta.value?.name} is connected.`, color: 'success' })
    await refresh()
  } catch (err) {
    credentialModal.value?.markTestResult(false, formatPbClientError(err))
  } finally {
    credentialModal.value?.setSaving(false)
    cardLoading.value[provider] = false
  }
}

function requestDisconnect(connection: AnalyticsConnection) {
  disconnectTarget.value = connection
  disconnectOpen.value = true
}

async function confirmDisconnect() {
  if (!disconnectTarget.value) return
  disconnecting.value = true
  const provider = disconnectTarget.value.provider
  const name = providers.value.find((p) => p.id === provider)?.name || provider
  try {
    await disconnect(disconnectTarget.value.id)
    disconnectOpen.value = false
    disconnectTarget.value = null
    announce(`${name} disconnected`)
    toast.add({ title: 'Disconnected', description: `${name} credentials were removed.`, color: 'neutral' })
  } catch (err) {
    toast.add({ title: 'Disconnect failed', description: formatPbClientError(err), color: 'error' })
  } finally {
    disconnecting.value = false
  }
}

async function onReconnect(connection: AnalyticsConnection) {
  if (connection.provider === 'ga4') {
    await beginGa4OAuth(connection.site)
    return
  }
  activeProvider.value = connection.provider
  modalOpen.value = true
}

async function openGa4PropertyPicker(connectionId: string) {
  ga4ConnectionId.value = connectionId
  ga4PickerOpen.value = true
  ga4Loading.value = true
  try {
    const data = await listGa4Properties(connectionId)
    ga4Properties.value = data.properties || []
  } catch (err) {
    toast.add({ title: 'Could not list properties', description: formatPbClientError(err), color: 'error' })
    ga4PickerOpen.value = false
  } finally {
    ga4Loading.value = false
  }
}

async function onGa4PropertySelect(property: { id: string, label: string }) {
  try {
    await setGa4Property(ga4ConnectionId.value, property.id, property.label)
    ga4PickerOpen.value = false
    flashHighlight('ga4')
    announce('Google Analytics 4 property saved')
    toast.add({ title: 'Property saved', color: 'success' })
    await refresh()
  } catch (err) {
    toast.add({ title: 'Could not save property', description: formatPbClientError(err), color: 'error' })
  }
}

function onManage(connection: AnalyticsConnection) {
  if (connection.provider === 'ga4' && connection.credentials_meta?.pendingPropertySelection) {
    void openGa4PropertyPicker(connection.id)
    return
  }
  toast.add({
    title: connection.expand?.site?.name || 'Connected',
    description: connection.last_synced_at
      ? `Last synced ${new Date(connection.last_synced_at).toLocaleString()}`
      : 'Waiting for first sync',
    color: 'neutral'
  })
}

onMounted(async () => {
  await awaitAuthReady()
  pageReady.value = true
  await Promise.all([fetchSites(), refresh()])

  const ga4 = String(route.query.ga4 || '')
  if (ga4 === 'pick_property' && typeof route.query.connectionId === 'string') {
    await openGa4PropertyPicker(route.query.connectionId)
    await router.replace({ path: '/settings/integrations', query: {} })
  } else if (ga4 === 'error') {
    const message = typeof route.query.message === 'string' ? route.query.message : 'Google sign-in failed'
    toast.add({ title: 'GA4 connection failed', description: message, color: 'error' })
    announce(message)
    await router.replace({ path: '/settings/integrations', query: {} })
  }
})
</script>

<template>
  <AppDashboardPanel>
    <template #header>
      <DashboardPageNavbar title="Integrations" />
    </template>
    <template #body>
      <div class="space-y-6">
        <McpApiKeysPanel :can-manage="canManage" />

        <section>
          <h2 class="font-semibold mb-1">
            Analytics providers
          </h2>
          <p class="text-sm text-muted mb-4 max-w-2xl">
            Connect traffic analytics for each SiteNook site. Data syncs in the background into encrypted snapshots. Dashboards never call providers on page load.
          </p>

          <div
            class="sr-only"
            aria-live="polite"
            aria-atomic="true"
          >
            {{ liveMessage }}
          </div>

          <div
            v-if="loading && !providers.length"
            class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <div
              v-for="n in 6"
              :key="n"
              class="h-40 rounded-lg bg-elevated/25 border border-default animate-pulse motion-reduce:animate-none"
            />
          </div>

          <div
            v-else
            class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
          >
            <AnalyticsProviderCard
              v-for="provider in providers"
              :key="provider.id"
              :provider="provider.id"
              :name="provider.name"
              :description="provider.description"
              :monogram="provider.monogram"
              :connections="connectionsForProvider(provider.id)"
              :can-manage="canManage"
              :highlight="highlightedProvider === provider.id"
              :loading="cardLoading[provider.id]"
              @connect="onConnect(provider.id)"
              @manage="onManage"
              @disconnect="requestDisconnect"
              @reconnect="onReconnect"
            />
          </div>
        </section>
      </div>

      <AnalyticsCredentialConnectModal
        ref="credentialModal"
        v-model:open="modalOpen"
        :provider="activeProvider || 'plausible'"
        :provider-name="activeProvider === 'ga4' ? 'Google Analytics 4' : (activeMeta?.name || '')"
        :fields="activeProvider === 'ga4' ? [] : (activeMeta?.fields || [])"
        :sites="siteOptions"
        @test="onTest"
        @save="onSave"
      />

      <AnalyticsGa4PropertyPicker
        v-model:open="ga4PickerOpen"
        :properties="ga4Properties"
        :loading="ga4Loading"
        @select="onGa4PropertySelect"
      />

      <UModal
        v-model:open="disconnectOpen"
        :ui="{ content: 'sm:max-w-md' }"
      >
        <template #content>
          <div class="p-4 sm:p-6 space-y-4">
            <h2 class="font-semibold text-lg">
              Disconnect provider?
            </h2>
            <p class="text-sm text-muted">
              This permanently removes stored credentials for this connection and stops syncing. You can reconnect later with a new token or OAuth login.
            </p>
            <div class="flex justify-end gap-2">
              <UButton
                color="neutral"
                variant="ghost"
                @click="disconnectOpen = false"
              >
                Cancel
              </UButton>
              <UButton
                color="error"
                :loading="disconnecting"
                @click="confirmDisconnect"
              >
                Disconnect
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </template>
  </AppDashboardPanel>
</template>
