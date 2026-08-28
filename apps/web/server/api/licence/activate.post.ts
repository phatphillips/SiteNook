import { createError, readBody } from 'h3'
import { requirePbUser } from '../../utils/requirePbUser'
import { getPbAdmin } from '../../utils/pbAdmin'
import { canWriteOrg, requireUserOrganizationId } from '~/utils/orgAccess'
import {
  buildLicensedApplianceStatus,
  isApplianceDeploymentMode
} from '../../utils/applianceLicenceStatus'
import { DEFAULT_POLAR_API_BASE, hintLicenceKey, validatePolarLicenseKey } from '../../utils/polarLicence'
import { SELFHOST_PLAN_MIRROR } from '~/utils/licenceTiers'

/** Activate a Polar (or env-validated) self-host licence key for this appliance. */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  if (!isApplianceDeploymentMode(config.public.deploymentMode)) {
    throw createError({ statusCode: 400, statusMessage: 'Licence activation is only available on self-host installs' })
  }

  const user = await requirePbUser(event)
  if (!canWriteOrg(user)) {
    throw createError({ statusCode: 403, statusMessage: 'Only organization admins can activate a licence' })
  }

  const body = await readBody<{ key?: string }>(event)
  const key = String(body?.key || '').trim()
  if (!key || key.length > 200) {
    throw createError({ statusCode: 400, statusMessage: 'Paste a valid licence key' })
  }

  const organizationId = String(
    config.public.polarOrganizationId
    || process.env.SITENOOK_POLAR_ORGANIZATION_ID
    || process.env.NUXT_PUBLIC_POLAR_ORGANIZATION_ID
    || ''
  ).trim()
  if (!organizationId) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Polar is not configured. Set SITENOOK_POLAR_ORGANIZATION_ID in .env (Polar dashboard → Settings → Organization ID).'
    })
  }

  const polar = await validatePolarLicenseKey({
    key,
    organizationId,
    apiBase: String(config.public.polarApiUrl || process.env.SITENOOK_POLAR_API_URL || DEFAULT_POLAR_API_BASE)
  })
  if (!polar.valid) {
    throw createError({
      statusCode: 400,
      statusMessage: polar.error || 'Licence key is not valid'
    })
  }

  const orgId = requireUserOrganizationId(user)
  const pb = await getPbAdmin(event)
  await pb.collection('organizations').update(orgId, {
    licence_key: key,
    plan: SELFHOST_PLAN_MIRROR
  })

  const status = buildLicensedApplianceStatus('selfhost')
  return {
    ...status,
    keyConfigured: true,
    keyHint: hintLicenceKey(key),
    polarConfigured: true,
    checkoutUrl: String(config.public.polarCheckoutUrl || '')
  }
})
