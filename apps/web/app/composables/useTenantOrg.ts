import { createSharedComposable } from '@vueuse/core'
import type { TenantContext } from '~/types/tenant'
import { TENANT_CONTEXT_TIMEOUT_MS } from '~/utils/fetchTimeout'
import { parseHostSubdomain } from '~/utils/subdomain'

function readRequestHost(): string {
  if (import.meta.client) {
    return window.location.host
  }

  const headers = useRequestHeaders(['host', 'x-forwarded-host'])
  return String(headers['x-forwarded-host'] || headers.host || '')
}

const _useTenantOrg = () => {
  const context = useState<TenantContext | null>('tenant-context', () => null)
  const ready = useState('tenant-context-ready', () => false)
  const loadError = useState<string | null>('tenant-context-error', () => null)
  const resolvedHost = useState('tenant-resolved-host', () => '')

  async function loadTenantContext(force = false) {
    const currentHost = readRequestHost()

    if (!force && ready.value && context.value && resolvedHost.value === currentHost) {
      return context.value
    }

    try {
      let data: TenantContext

      if (import.meta.server) {
        const config = useRuntimeConfig()
        const parsed = parseHostSubdomain(readRequestHost(), config.public.appDomain)
        if (parsed.isApex || !parsed.subdomain) {
          // Resolve apex in-process — internal fetch deadlocks Nuxt dev SSR.
          data = { mode: 'apex', subdomain: null, organization: null }
        } else {
          const requestFetch = useRequestFetch()
          data = await requestFetch<TenantContext>('/api/org-context')
        }
      } else {
        data = await $fetch<TenantContext>('/api/org-context', {
          headers: currentHost ? { 'x-forwarded-host': currentHost } : undefined,
          timeout: TENANT_CONTEXT_TIMEOUT_MS
        })
      }

      context.value = data
      loadError.value = null
      ready.value = true
      resolvedHost.value = currentHost
      return data
    } catch (error) {
      loadError.value = error instanceof Error ? error.message : 'Could not resolve organization'
      ready.value = true
      throw error
    }
  }

  const organization = computed(() => context.value?.organization ?? null)
  const subdomain = computed(() => context.value?.subdomain ?? null)
  const isTenantHost = computed(() => context.value?.mode === 'tenant')
  const isUnknownTenant = computed(() => context.value?.mode === 'unknown')
  const isApexHost = computed(() => context.value?.mode === 'apex' || !context.value)

  function hostLooksLikeUnknownTenant(): boolean {
    const config = useRuntimeConfig()
    const parsed = parseHostSubdomain(readRequestHost(), config.public.appDomain)
    return !!parsed.subdomain && !parsed.isApex
  }

  function requireTenantOrganizationId(): string {
    const orgId = organization.value?.id
    if (!orgId) {
      throw new Error('Organization context is not available on this host.')
    }
    return orgId
  }

  return {
    context,
    organization,
    subdomain,
    ready,
    loadError,
    isTenantHost,
    isUnknownTenant,
    isApexHost,
    hostLooksLikeUnknownTenant,
    loadTenantContext,
    requireTenantOrganizationId
  }
}

export const useTenantOrg = createSharedComposable(_useTenantOrg)
