import type {
  AnalyticsConnection,
  AnalyticsProvider
} from '~/types/sitenook'

export interface AnalyticsCredentialField {
  key: string
  label: string
  type: 'text' | 'password' | 'url'
  required: boolean
  placeholder?: string
  help?: string
}

export interface AnalyticsProviderMeta {
  id: AnalyticsProvider
  name: string
  description: string
  monogram: string
  fields: AnalyticsCredentialField[]
}

export function useAnalyticsConnections() {
  const { pb } = usePocketBase()

  const connections = ref<AnalyticsConnection[]>([])
  const providers = ref<AnalyticsProviderMeta[]>([])
  const loading = ref(false)
  const error = ref('')

  function authHeaders(): HeadersInit {
    const token = pb?.authStore.token
    return token ? { Authorization: `Bearer ${token}` } : {}
  }

  async function fetchConnections(siteId?: string) {
    loading.value = true
    error.value = ''
    try {
      const query = siteId ? `?siteId=${encodeURIComponent(siteId)}` : ''
      const data = await $fetch<{
        connections: AnalyticsConnection[]
        providers: AnalyticsProviderMeta[]
      }>(`/api/analytics/connections${query}`, {
        headers: authHeaders()
      })
      connections.value = data.connections || []
      providers.value = data.providers || []
    } catch (err: any) {
      error.value = err?.data?.statusMessage || err?.message || 'Failed to load integrations'
      throw err
    } finally {
      loading.value = false
    }
  }

  async function testConnection(provider: AnalyticsProvider, credentials: Record<string, string>) {
    return await $fetch<{ ok: boolean, error?: string }>('/api/analytics/connections/test', {
      method: 'POST',
      headers: authHeaders(),
      body: { provider, credentials }
    })
  }

  async function saveConnection(input: {
    provider: AnalyticsProvider
    siteId: string
    credentials: Record<string, string>
    reconnect?: boolean
  }) {
    const data = await $fetch<{ connection: AnalyticsConnection }>('/api/analytics/connections', {
      method: 'POST',
      headers: authHeaders(),
      body: input
    })
    const idx = connections.value.findIndex((c) => c.id === data.connection.id)
    if (idx >= 0) connections.value[idx] = data.connection
    else connections.value.push(data.connection)
    return data.connection
  }

  async function disconnect(connectionId: string) {
    await $fetch(`/api/analytics/connections/${connectionId}`, {
      method: 'DELETE',
      headers: authHeaders()
    })
    connections.value = connections.value.filter((c) => c.id !== connectionId)
  }

  async function startGa4OAuth(siteId: string) {
    const data = await $fetch<{ url: string }>('/api/analytics/oauth/ga4/start', {
      headers: authHeaders(),
      query: { siteId }
    })
    return data.url
  }

  async function listGa4Properties(connectionId: string) {
    return await $fetch<{ properties: Array<{ id: string, label: string }> }>(
      `/api/analytics/connections/${connectionId}/properties`,
      { headers: authHeaders() }
    )
  }

  async function setGa4Property(
    connectionId: string,
    propertyId: string,
    propertyLabel?: string
  ) {
    const data = await $fetch<{ connection: AnalyticsConnection }>(
      `/api/analytics/connections/${connectionId}/property`,
      {
        method: 'POST',
        headers: authHeaders(),
        body: { propertyId, propertyLabel }
      }
    )
    const idx = connections.value.findIndex((c) => c.id === data.connection.id)
    if (idx >= 0) connections.value[idx] = data.connection
    else connections.value.push(data.connection)
    return data.connection
  }

  function connectionsForProvider(provider: AnalyticsProvider) {
    return connections.value.filter((c) => c.provider === provider)
  }

  return {
    connections,
    providers,
    loading,
    error,
    fetchConnections,
    testConnection,
    saveConnection,
    disconnect,
    startGa4OAuth,
    listGa4Properties,
    setGa4Property,
    connectionsForProvider
  }
}
