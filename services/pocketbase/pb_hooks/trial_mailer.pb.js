/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/sitenook/notify-trial-nudge', (c) => {
  const body = $apis.requestInfo(c).data || {}
  const organizationId = String(body.organizationId || '').trim()
  const daysRemaining = Number(body.daysRemaining)
  if (!organizationId) {
    return c.json(400, { error: 'organizationId is required' })
  }
  if (!Number.isFinite(daysRemaining)) {
    return c.json(400, { error: 'daysRemaining is required' })
  }

  let org
  try {
    org = c.app.findRecordById('organizations', organizationId)
  } catch (_) {
    return c.json(404, { error: 'Organization not found' })
  }

  const mailer = require(`${__hooks}/trial_mailer_lib.js`)
  const sent = mailer.notifyTrialNudge(c.app, org, daysRemaining)
  return c.json(200, { sent })
}, $apis.requireSuperuserAuth())

routerAdd('POST', '/api/sitenook/notify-trial-expired', (c) => {
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

  const mailer = require(`${__hooks}/trial_mailer_lib.js`)
  const sent = mailer.notifyTrialExpired(c.app, org)
  return c.json(200, { sent })
}, $apis.requireSuperuserAuth())
