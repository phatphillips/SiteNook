/// <reference path="../pb_data/types.d.ts" />

/**
 * Rewrite password-reset email links to the user's tenant origin
 * (e.g. test-agency.localhost:3000 instead of apex localhost:3000).
 *
 * Unverified users (invites / first admin) get account-setup copy and ?setup=1.
 * Verified users (forgot-password) get reset-password copy.
 */
onMailerRecordPasswordResetSend((e) => {
  const mailer = require(`${__hooks}/mailer_tenant_reset_lib.js`)

  const appName = String($os.getenv('APP_NAME') || 'AccessIQ').trim() || 'AccessIQ'
  const isInvite = !e.record.get('verified')
  const dashboardUrl = String($os.getenv('APP_DASHBOARD_URL') || 'http://localhost:3000').replace(/\/$/, '')

  let actionUrl = mailer.extractActionUrl(e)

  const orgId = e.record.get('organization')
  if (orgId && actionUrl) {
    let org
    try {
      org = e.app.findRecordById('organizations', String(orgId))
    } catch (_) {
      org = null
    }

    if (org) {
      const subdomain = String(org.get('subdomain') || '').trim().toLowerCase()
      if (subdomain) {
        const appDomain = String($os.getenv('APP_PUBLIC_DOMAIN') || 'localhost').trim().toLowerCase()
        const tenantOrigin = mailer.buildTenantOrigin(dashboardUrl, subdomain, appDomain)

        if (tenantOrigin !== dashboardUrl) {
          actionUrl = actionUrl.replaceAll(dashboardUrl, tenantOrigin)
        }
      }
    }
  }

  if (isInvite && actionUrl) {
    actionUrl = mailer.appendSetupParam(actionUrl)
  }

  if (isInvite) {
    e.message.subject = 'Set up your ' + appName + ' account'
    e.message.html =
      '<p>Hello,</p>\n'
      + '<p>You have been invited to ' + appName + '. Click the button below to choose a password and sign in.</p>\n'
      + '<p><a href="' + actionUrl + '" target="_blank" rel="noopener">Set up account</a></p>\n'
      + '<p>If you did not expect this email, you can ignore it.</p>\n'
      + '<p>Thanks,<br/>' + appName + ' team</p>'
    e.message.text =
      'Hello,\n\n'
      + 'You have been invited to ' + appName + '. Open the link below to choose a password and sign in.\n\n'
      + actionUrl + '\n\n'
      + 'If you did not expect this email, you can ignore it.\n\n'
      + 'Thanks,\n' + appName + ' team'
  } else {
    e.message.subject = 'Reset your ' + appName + ' password'
    e.message.html =
      '<p>Hello,</p>\n'
      + '<p>Click the button below to reset your password.</p>\n'
      + '<p><a href="' + actionUrl + '" target="_blank" rel="noopener">Reset password</a></p>\n'
      + '<p>If you did not ask to reset your password, you can ignore this email.</p>\n'
      + '<p>Thanks,<br/>' + appName + ' team</p>'
    e.message.text =
      'Hello,\n\n'
      + 'Open the link below to reset your password.\n\n'
      + actionUrl + '\n\n'
      + 'If you did not ask to reset your password, you can ignore this email.\n\n'
      + 'Thanks,\n' + appName + ' team'
  }

  return e.next()
})
