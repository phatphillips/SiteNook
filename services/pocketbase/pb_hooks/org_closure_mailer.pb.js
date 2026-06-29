/// <reference path="../pb_data/types.d.ts" />

/**
 * Send closure emails to billing contacts (called from Nitro after org enters closing).
 * Requires PocketBase SMTP in Settings → Mail settings.
 */
routerAdd('POST', '/api/accessiq/notify-org-closure', (c) => {
  const body = $apis.requestInfo(c).data || {}
  const organizationId = String(body.organizationId || '').trim()
  if (!organizationId) {
    return c.json(400, { error: 'organizationId is required' })
  }

  let org
  try {
    org = c.app.findRecordById('organizations', organizationId)
  } catch (_) {
    return c.json(404, { error: 'Organization not found' })
  }

  const mailer = require(`${__hooks}/org_closure_mailer_lib.js`)
  const sent = mailer.notifyBillingContactsOfClosure(c.app, org)
  return c.json(200, { sent })
}, $apis.requireSuperuserAuth())

routerAdd('POST', '/api/accessiq/notify-org-churn', (c) => {
  const body = $apis.requestInfo(c).data || {}
  const organizationId = String(body.organizationId || '').trim()
  if (!organizationId) {
    return c.json(400, { error: 'organizationId is required' })
  }

  let org
  try {
    org = c.app.findRecordById('organizations', organizationId)
  } catch (_) {
    return c.json(404, { error: 'Organization not found' })
  }

  const mailer = require(`${__hooks}/org_closure_mailer_lib.js`)
  const sent = mailer.notifyBillingContactsOfChurn(c.app, org)
  return c.json(200, { sent })
}, $apis.requireSuperuserAuth())
