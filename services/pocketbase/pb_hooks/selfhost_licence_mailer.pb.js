/// <reference path="../pb_data/types.d.ts" />

routerAdd('POST', '/api/sitenook/notify-selfhost-licence', (c) => {
  const body = $apis.requestInfo(c).data || {}
  const email = String(body.email || '').trim()
  const licenceKey = String(body.licenceKey || '').trim()
  const expiresAt = String(body.expiresAt || '').trim()

  if (!email || !licenceKey) {
    return c.json(400, { error: 'email and licenceKey are required' })
  }

  const mailer = require(`${__hooks}/selfhost_licence_mailer_lib.js`)
  const sent = mailer.sendLicenceMail(c.app, email, licenceKey, expiresAt)
  return c.json(200, { sent })
}, $apis.requireSuperuserAuth())
