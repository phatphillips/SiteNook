import type { RecordModel } from 'pocketbase'
import PocketBase from 'pocketbase'
import { createError, getHeader, type H3Event } from 'h3'
import { requirePbUser } from './requirePbUser'
import { getPbAdmin } from './pbAdmin'
import { requireUserOrganizationId, canWriteOrg } from '~/utils/orgAccess'
import { resolveServerPocketBaseUrl } from './resolvePbUrl'
import {
  findApiKeyBySecret,
  isApiKeyToken,
  scopesAllowWrite,
  touchApiKeyLastUsed,
  type ApiKeyRecord,
  type ApiKeyScope
} from './apiKeys'

function extractBearer(event: H3Event): string | null {
  const header = getHeader(event, 'authorization')?.trim()
  if (!header) return null
  return header.replace(/^Bearer\s+/i, '').trim() || null
}

export interface AgentAuthContext {
  orgId: string
  pb: PocketBase
  authMode: 'api_key' | 'user'
  canWrite: boolean
  scopes: ApiKeyScope[]
  user: RecordModel | null
  apiKey: ApiKeyRecord | null
}

/**
 * Auth for /api/agent/* — accepts org API keys (`ak_…`) or a PocketBase user JWT.
 * API-key path uses the admin PB client and enforces org scoping in handlers.
 */
export async function requireAgentAuth(event: H3Event): Promise<AgentAuthContext> {
  const token = extractBearer(event)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  if (isApiKeyToken(token)) {
    const admin = await getPbAdmin(event)
    const apiKey = await findApiKeyBySecret(admin, token)
    if (!apiKey) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid API key' })
    }
    void touchApiKeyLastUsed(admin, apiKey.id).catch(() => {})
    return {
      orgId: apiKey.organization,
      pb: admin,
      authMode: 'api_key',
      canWrite: scopesAllowWrite(apiKey.scopes),
      scopes: apiKey.scopes,
      user: null,
      apiKey
    }
  }

  const user = await requirePbUser(event)
  const orgId = requireUserOrganizationId(user)
  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.autoCancellation(false)
  pb.authStore.save(token, user)

  return {
    orgId,
    pb,
    authMode: 'user',
    canWrite: canWriteOrg(user),
    scopes: canWriteOrg(user) ? ['read', 'write'] : ['read'],
    user,
    apiKey: null
  }
}

export function requireAgentWrite(ctx: AgentAuthContext): void {
  if (!ctx.canWrite) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Write access required (API key needs write scope, or org admin role)'
    })
  }
}

/** Ensure site belongs to the authenticated org; return site record fields used by agents. */
export async function requireAgentSiteAccess(
  ctx: AgentAuthContext,
  siteId: string
): Promise<{ id: string, organization: string, name?: string, url?: string }> {
  if (!siteId.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'siteId is required' })
  }

  try {
    const site = await ctx.pb.collection('sites').getOne(siteId, {
      fields: 'id,organization,name,url,default_scan_config'
    }) as { id: string, organization?: string, name?: string, url?: string }

    if (site.organization !== ctx.orgId) {
      throw createError({ statusCode: 403, statusMessage: 'Forbidden' })
    }
    return {
      id: site.id,
      organization: String(site.organization),
      name: site.name,
      url: site.url
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    throw createError({ statusCode: 404, statusMessage: 'Site not found' })
  }
}
