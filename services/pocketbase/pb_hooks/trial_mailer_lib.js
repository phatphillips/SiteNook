function formatTrialEndDate(iso) {
  if (!iso) return 'soon'
  const date = new Date(String(iso))
  if (Number.isNaN(date.getTime())) return 'soon'
  return date.toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' })
}

function listBillingContactEmails(app, organizationId) {
  const orgId = String(organizationId || '').trim()
  if (!orgId) return []

  let users = []
  try {
    users = app.findRecordsByFilter(
      'users',
      'organization = {:org} && (is_billing_contact = true)',
      '-created',
      200,
      0,
      { org: orgId }
    )
  } catch (_) {
    return []
  }

  const emails = []
  const seen = new Set()
  for (let i = 0; i < users.length; i++) {
    const email = String(users[i].get('email') || '').trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }
  return emails
}

function tenantOriginFor(orgRecord) {
  const mailer = require(`${__hooks}/mailer_tenant_reset_lib.js`)
  const dashboardUrl = String($os.getenv('APP_DASHBOARD_URL') || 'http://localhost:3000').replace(/\/$/, '')
  const appDomain = String($os.getenv('APP_PUBLIC_DOMAIN') || 'localhost').trim().toLowerCase()
  const subdomain = String(orgRecord.get('subdomain') || '').trim().toLowerCase()
  return subdomain
    ? mailer.buildTenantOrigin(dashboardUrl, subdomain, appDomain)
    : dashboardUrl
}

function buildTrialNudgeEmail(orgRecord, daysRemaining) {
  const appName = String($os.getenv('APP_NAME') || 'SiteNook').trim() || 'SiteNook'
  const supportEmail = String($os.getenv('NUXT_PUBLIC_SUPPORT_EMAIL') || 'contact@your-org.com').trim()
  const orgName = String(orgRecord.get('name') || 'your organization').trim() || 'your organization'
  const endLabel = formatTrialEndDate(orgRecord.get('trial_ends_at'))
  const origin = tenantOriginFor(orgRecord)
  const billingUrl = origin + '/settings/billing'
  const daysLabel = daysRemaining <= 1 ? '1 day' : (daysRemaining + ' days')

  const subject = orgName + ' — Team trial ends in ' + daysLabel
  const html =
    '<p>Hello,</p>\n'
    + '<p>Your <strong>Team</strong> trial for <strong>' + orgName + '</strong> on ' + appName
    + ' ends in <strong>' + daysLabel + '</strong> (' + endLabel + ').</p>\n'
    + '<p>Upgrade to keep scheduled scans, SEO, readability, and higher limits — annual billing saves about 15%.</p>\n'
    + '<p><a href="' + billingUrl + '">Manage billing</a></p>\n'
    + '<p>If you do nothing, SiteNook will move you to Free (1 site, 20 pages per scan) when the trial ends.</p>\n'
    + '<p>Questions? <a href="mailto:' + supportEmail + '">' + supportEmail + '</a></p>\n'
    + '<p>Thanks,<br/>' + appName + ' team</p>'
  const text =
    'Hello,\n\n'
    + 'Your Team trial for ' + orgName + ' on ' + appName + ' ends in ' + daysLabel + ' (' + endLabel + ').\n\n'
    + 'Upgrade to keep scheduled scans, SEO, readability, and higher limits — annual billing saves about 15%.\n'
    + 'Manage billing: ' + billingUrl + '\n\n'
    + 'If you do nothing, you will move to Free (1 site, 20 pages per scan).\n\n'
    + 'Questions? ' + supportEmail + '\n\n'
    + 'Thanks,\n' + appName + ' team'

  return { subject, html, text }
}

function buildTrialExpiredEmail(orgRecord) {
  const appName = String($os.getenv('APP_NAME') || 'SiteNook').trim() || 'SiteNook'
  const supportEmail = String($os.getenv('NUXT_PUBLIC_SUPPORT_EMAIL') || 'contact@your-org.com').trim()
  const orgName = String(orgRecord.get('name') || 'your organization').trim() || 'your organization'
  const origin = tenantOriginFor(orgRecord)
  const billingUrl = origin + '/settings/billing'

  const subject = orgName + ' — Team trial ended on ' + appName
  const html =
    '<p>Hello,</p>\n'
    + '<p>Your Team trial for <strong>' + orgName + '</strong> has ended. SiteNook moved your organization to the <strong>Free</strong> plan.</p>\n'
    + '<p>You still have 1 site and 20 pages per scan for accessibility and QA checks. Upgrade anytime to restore Team features.</p>\n'
    + '<p><a href="' + billingUrl + '">Upgrade on Billing</a></p>\n'
    + '<p>Questions? <a href="mailto:' + supportEmail + '">' + supportEmail + '</a></p>\n'
    + '<p>Thanks,<br/>' + appName + ' team</p>'
  const text =
    'Hello,\n\n'
    + 'Your Team trial for ' + orgName + ' has ended. SiteNook moved your organization to Free.\n\n'
    + 'You still have 1 site and 20 pages per scan. Upgrade anytime: ' + billingUrl + '\n\n'
    + 'Questions? ' + supportEmail + '\n\n'
    + 'Thanks,\n' + appName + ' team'

  return { subject, html, text }
}

function sendToBillingContacts(app, orgRecord, message) {
  const emails = listBillingContactEmails(app, orgRecord.id)
  let sent = 0
  for (let i = 0; i < emails.length; i++) {
    try {
      const msg = new MailerMessage({
        from: {
          address: app.settings().meta.senderAddress,
          name: app.settings().meta.senderName || 'SiteNook'
        },
        to: [{ address: emails[i] }],
        subject: message.subject,
        html: message.html,
        text: message.text
      })
      app.newMailClient().send(msg)
      sent += 1
    } catch (err) {
      console.error('[trial_mailer] failed to send to', emails[i], err)
    }
  }
  return sent
}

function notifyTrialNudge(app, orgRecord, daysRemaining) {
  return sendToBillingContacts(app, orgRecord, buildTrialNudgeEmail(orgRecord, daysRemaining))
}

function notifyTrialExpired(app, orgRecord) {
  return sendToBillingContacts(app, orgRecord, buildTrialExpiredEmail(orgRecord))
}

module.exports = {
  notifyTrialNudge,
  notifyTrialExpired,
  listBillingContactEmails
}
