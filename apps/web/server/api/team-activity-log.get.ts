import PocketBase, { ClientResponseError } from 'pocketbase'
import { createError, getHeader, getQuery, type H3Event } from 'h3'
import { requirePbUser } from '../utils/requirePbUser'
import { resolveServerPocketBaseUrl } from '../utils/resolvePbUrl'

function createUserPb(event: H3Event, token: string, user: Record<string, unknown>) {
  const pb = new PocketBase(resolveServerPocketBaseUrl(event))
  pb.authStore.save(token, user as never)
  return pb
}

async function listTeamActivity(
  pb: PocketBase,
  page: number,
  perPage: number
) {
  try {
    return await pb.collection('team_activity_log').getList(page, perPage, {
      sort: '-logged_at'
    })
  } catch (error) {
    if (!(error instanceof ClientResponseError) || error.status !== 400) {
      throw error
    }

    const fallback = await pb.collection('team_activity_log').getList(page, perPage)
    fallback.items.sort((a, b) => String(b.id).localeCompare(String(a.id)))
    return fallback
  }
}

export default defineEventHandler(async (event) => {
  const token = getHeader(event, 'authorization')?.replace(/^Bearer\s+/i, '').trim()
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const user = await requirePbUser(event)
  const organizationId = typeof user.organization === 'string' ? user.organization : ''
  if (!organizationId) {
    throw createError({ statusCode: 400, statusMessage: 'Your account is not assigned to an organization.' })
  }

  const query = getQuery(event)
  const page = Math.max(1, Number(query.page) || 1)
  const perPage = Math.min(50, Math.max(1, Number(query.perPage) || 20))

  const pb = createUserPb(event, token, user)

  try {
    const result = await listTeamActivity(pb, page, perPage)

    return {
      page: result.page,
      perPage: result.perPage,
      totalItems: result.totalItems,
      totalPages: result.totalPages,
      items: result.items.map(record => ({
        id: record.id,
        action: record.action,
        created: String(record.logged_at ?? record.created ?? ''),
        details: record.details ?? null,
        actor: record.actor ?? null,
        target: record.target ?? null
      }))
    }
  } catch (error) {
    if (error instanceof ClientResponseError) {
      if (error.status === 404) {
        return {
          page: 1,
          perPage,
          totalItems: 0,
          totalPages: 0,
          items: []
        }
      }

      throw createError({
        statusCode: error.status || 502,
        statusMessage: error.message || 'Failed to load team activity log'
      })
    }

    throw createError({
      statusCode: 502,
      statusMessage: error instanceof Error ? error.message : 'Failed to load team activity log'
    })
  }
})
