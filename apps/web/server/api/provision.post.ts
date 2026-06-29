import { createError } from 'h3'
import type { ProvisionOrganizationInput } from '~/server/utils/provisioning'

export default defineEventHandler(async (event) => {
  requireProvisionApiKey(event)

  const body = await readBody<Partial<ProvisionOrganizationInput>>(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  const input: ProvisionOrganizationInput = {
    orgName: String(body.orgName ?? ''),
    subdomain: String(body.subdomain ?? ''),
    ownerName: String(body.ownerName ?? ''),
    ownerEmail: String(body.ownerEmail ?? ''),
    plan: body.plan ? String(body.plan) : undefined
  }

  const config = useRuntimeConfig(event)
  const pb = await getPbAdmin(event)

  try {
    return await provisionOrganization(pb, input, {
      appDomain: config.public.appDomain,
      appUrl: config.public.appUrl,
      createdVia: 'provision_api'
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    const message = formatPbError(error)
    const statusCode = /already in use|reserved|must be|required|not valid|already registered/i.test(message) ? 400 : 502
    throw createError({ statusCode, statusMessage: message })
  }
})
