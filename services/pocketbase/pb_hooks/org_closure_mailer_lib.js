function formatPurgeDate(iso) {
  if (!iso) return 'the scheduled date'
  const date = new Date(String(iso))
  if (Number.isNaN(date.getTime())) return 'the scheduled date'
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

function buildChurnRetentionEmail(app, orgRecord) {
  const mailer = require(`${__hooks}/mailer_tenant_reset_lib.js`)
  const appName = String($os.getenv('APP_NAME') || 'SiteNook').trim() || 'SiteNook'
  const supportEmail = String($os.getenv('NUXT_PUBLIC_SUPPORT_EMAIL') || 'contact@your-org.com').trim()
  const dashboardUrl = String($os.getenv('APP_DASHBOARD_URL') || 'http://localhost:3000').replace(/\/$/, '')
  const appDomain = String($os.getenv('APP_PUBLIC_DOMAIN') || 'localhost').trim().toLowerCase()

  const orgName = String(orgRecord.get('name') || 'your organization').trim() || 'your organization'
  const subdomain = String(orgRecord.get('subdomain') || '').trim().toLowerCase()
  const purgeLabel = formatPurgeDate(orgRecord.get('purge_scheduled_at'))
  const tenantOrigin = subdomain
    ? mailer.buildTenantOrigin(dashboardUrl, subdomain, appDomain)
    : dashboardUrl

  const subject = orgName + ' — subscription canceled on ' + appName
  const html =
    '<p>Hello,</p>\n'
    + '<p>The Stripe subscription for <strong>' + orgName + '</strong> on ' + appName + ' has been canceled.</p>\n'
    + '<p>Your organization remains <strong>accessible</strong> during a 30-day retention period. Scheduled scans have stopped.</p>\n'
    + '<p>Your data will be permanently deleted after <strong>' + purgeLabel + '</strong> unless you resubscribe or contact support.</p>\n'
    + '<p>Sign in at <a href="' + tenantOrigin + '">' + tenantOrigin + '</a> to export data or manage billing.</p>\n'
    + '<p>Questions? Contact us at <a href="mailto:' + supportEmail + '">' + supportEmail + '</a>.</p>\n'
    + '<p>Thanks,<br/>' + appName + ' team</p>'
  const text =
    'Hello,\n\n'
    + 'The Stripe subscription for ' + orgName + ' on ' + appName + ' has been canceled.\n\n'
    + 'Your organization remains accessible during a 30-day retention period. Scheduled scans have stopped.\n\n'
    + 'Your data will be permanently deleted after ' + purgeLabel + ' unless you resubscribe or contact support.\n\n'
    + 'Sign in: ' + tenantOrigin + '\n\n'
    + 'Questions? Contact ' + supportEmail + '.\n\n'
    + 'Thanks,\n' + appName + ' team'

  return { subject, html, text }
}

function buildClosureEmail(app, orgRecord) {
  const mailer = require(`${__hooks}/mailer_tenant_reset_lib.js`)
  const appName = String($os.getenv('APP_NAME') || 'SiteNook').trim() || 'SiteNook'
  const supportEmail = String($os.getenv('NUXT_PUBLIC_SUPPORT_EMAIL') || 'contact@your-org.com').trim()
  const dashboardUrl = String($os.getenv('APP_DASHBOARD_URL') || 'http://localhost:3000').replace(/\/$/, '')
  const appDomain = String($os.getenv('APP_PUBLIC_DOMAIN') || 'localhost').trim().toLowerCase()

  const orgName = String(orgRecord.get('name') || 'your organization').trim() || 'your organization'
  const subdomain = String(orgRecord.get('subdomain') || '').trim().toLowerCase()
  const purgeLabel = formatPurgeDate(orgRecord.get('purge_scheduled_at'))
  const tenantOrigin = subdomain
    ? mailer.buildTenantOrigin(dashboardUrl, subdomain, appDomain)
    : dashboardUrl

  const subject = orgName + ' — subscription canceled on ' + appName
  const html =
    '<p>Hello,</p>\n'
    + '<p>The Stripe subscription for <strong>' + orgName + '</strong> on ' + appName + ' has been canceled.</p>\n'
    + '<p>This organization is now <strong>closing</strong>. Team members will not be able to sign in, and scheduled scans have stopped.</p>\n'
    + '<p>Your data will be permanently deleted after <strong>' + purgeLabel + '</strong> (30-day retention).</p>\n'
    + '<p>If this was a mistake, contact us at <a href="mailto:' + supportEmail + '">' + supportEmail + '</a> before that date.</p>\n'
    + '<p>Thanks,<br/>' + appName + ' team</p>'
  const text =
    'Hello,\n\n'
    + 'The Stripe subscription for ' + orgName + ' on ' + appName + ' has been canceled.\n\n'
    + 'This organization is now closing. Team members will not be able to sign in, and scheduled scans have stopped.\n\n'
    + 'Your data will be permanently deleted after ' + purgeLabel + ' (30-day retention).\n\n'
    + 'If this was a mistake, contact ' + supportEmail + ' before that date.\n\n'
    + 'Tenant URL: ' + tenantOrigin + '\n\n'
    + 'Thanks,\n' + appName + ' team'

  return { subject, html, text }
}

function notifyBillingContactsOfChurn(app, orgRecord) {
  const emails = listBillingContactEmails(app, orgRecord.id)
  if (!emails.length) return 0

  const settings = app.settings()
  const fromAddress = String(settings.meta.senderAddress || '').trim()
  const fromName = String(settings.meta.senderName || 'SiteNook').trim()
  if (!fromAddress) {
    console.warn('[org_closure_mailer] senderAddress not configured; skipping churn emails')
    return 0
  }

  const content = buildChurnRetentionEmail(app, orgRecord)
  const mailClient = app.newMailClient()

  let sent = 0
  for (let i = 0; i < emails.length; i++) {
    const message = new MailerMessage({
      from: { address: fromAddress, name: fromName },
      to: [{ address: emails[i] }],
      subject: content.subject,
      html: content.html,
      text: content.text
    })
    try {
      mailClient.send(message)
      sent++
    } catch (error) {
      console.warn('[org_closure_mailer] failed to send churn email to', emails[i], error)
    }
  }
  return sent
}

function notifyBillingContactsOfClosure(app, orgRecord) {
  const emails = listBillingContactEmails(app, orgRecord.id)
  if (!emails.length) return 0

  const settings = app.settings()
  const fromAddress = String(settings.meta.senderAddress || '').trim()
  const fromName = String(settings.meta.senderName || 'SiteNook').trim()
  if (!fromAddress) {
    console.warn('[org_closure_mailer] senderAddress not configured; skipping closure emails')
    return 0
  }

  const content = buildClosureEmail(app, orgRecord)
  const mailClient = app.newMailClient()

  let sent = 0
  for (let i = 0; i < emails.length; i++) {
    const message = new MailerMessage({
      from: { address: fromAddress, name: fromName },
      to: [{ address: emails[i] }],
      subject: content.subject,
      html: content.html,
      text: content.text
    })
    try {
      mailClient.send(message)
      sent++
    } catch (error) {
      console.warn('[org_closure_mailer] failed to send to', emails[i], error)
    }
  }
  return sent
}

module.exports = {
  formatPurgeDate,
  listBillingContactEmails,
  buildChurnRetentionEmail,
  buildClosureEmail,
  notifyBillingContactsOfChurn,
  notifyBillingContactsOfClosure
}
