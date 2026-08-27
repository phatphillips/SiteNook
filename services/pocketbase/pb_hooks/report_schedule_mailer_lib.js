function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function parseRecipientIds(raw) {
  if (Array.isArray(raw)) {
    return raw.map(function (id) { return String(id || '').trim() }).filter(Boolean)
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return parsed.map(function (id) { return String(id || '').trim() }).filter(Boolean)
      }
    } catch (_) {}
  }
  return []
}

function listRecipientEmails(app, orgId, recipientIds) {
  const emails = []
  const seen = new Set()
  for (let i = 0; i < recipientIds.length; i++) {
    const id = recipientIds[i]
    let user
    try {
      user = app.findRecordById('users', id)
    } catch (_) {
      continue
    }
    if (String(user.get('organization') || '') !== String(orgId)) continue
    const email = String(user.get('email') || '').trim().toLowerCase()
    if (!email || seen.has(email)) continue
    seen.add(email)
    emails.push(email)
  }
  return emails
}

function buildReportReadyEmail(app, jobRecord, scheduleRecord) {
  const mailer = require(`${__hooks}/mailer_tenant_reset_lib.js`)
  const appName = String($os.getenv('APP_NAME') || 'SiteNook').trim() || 'SiteNook'
  const supportEmail = String($os.getenv('NUXT_PUBLIC_SUPPORT_EMAIL') || 'contact@your-org.com').trim()
  const dashboardUrl = String($os.getenv('APP_DASHBOARD_URL') || 'http://localhost:3000').replace(/\/$/, '')
  const appDomain = String($os.getenv('APP_PUBLIC_DOMAIN') || 'localhost').trim().toLowerCase()
  const publicAppUrl = String($os.getenv('NUXT_PUBLIC_APP_URL') || dashboardUrl).replace(/\/$/, '')

  let orgName = 'your organization'
  let subdomain = ''
  try {
    const org = app.findRecordById('organizations', jobRecord.get('org'))
    orgName = String(org.get('name') || orgName).trim() || orgName
    subdomain = String(org.get('subdomain') || '').trim().toLowerCase()
  } catch (_) {}

  const reportName = scheduleRecord
    ? String(scheduleRecord.get('name') || 'Scheduled report').trim() || 'Scheduled report'
    : String(jobRecord.get('artifact_name') || 'SiteNook report')
  const format = String(jobRecord.get('format') || 'pdf').toUpperCase()
  const shareToken = String(jobRecord.get('share_token') || '').trim()
  const downloadUrl = shareToken
    ? publicAppUrl + '/api/reports/share/' + encodeURIComponent(shareToken)
    : dashboardUrl + '/reports'

  const tenantOrigin = subdomain
    ? mailer.buildTenantOrigin(dashboardUrl, subdomain, appDomain)
    : dashboardUrl

  const completedAt = jobRecord.get('completed_at')
  const completedLabel = completedAt
    ? new Date(String(completedAt)).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })
    : 'just now'

  const subject = reportName + ' is ready — ' + appName
  const html =
    '<p>Hello,</p>\n'
    + '<p>Your scheduled report <strong>' + escapeHtml(reportName) + '</strong> for <strong>'
    + escapeHtml(orgName) + '</strong> is ready.</p>\n'
    + '<p>Format: ' + escapeHtml(format) + '<br/>Generated: ' + escapeHtml(completedLabel) + '</p>\n'
    + '<p><a href="' + escapeHtml(downloadUrl) + '">Download your report</a></p>\n'
    + '<p>You can also open your dashboard at <a href="' + escapeHtml(tenantOrigin) + '">'
    + escapeHtml(tenantOrigin) + '</a>.</p>\n'
    + '<p>Questions? Contact us at <a href="mailto:' + escapeHtml(supportEmail) + '">'
    + escapeHtml(supportEmail) + '</a>.</p>\n'
    + '<p>Thanks,<br/>' + escapeHtml(appName) + ' team</p>'

  const text =
    'Hello,\n\n'
    + 'Your scheduled report "' + reportName + '" for ' + orgName + ' is ready.\n\n'
    + 'Format: ' + format + '\n'
    + 'Generated: ' + completedLabel + '\n\n'
    + 'Download: ' + downloadUrl + '\n\n'
    + 'Dashboard: ' + tenantOrigin + '\n\n'
    + 'Questions? Contact ' + supportEmail + '.\n\n'
    + 'Thanks,\n' + appName + ' team'

  return { subject, html, text }
}

function notifyReportReady(app, jobRecord) {
  const scheduleId = String(jobRecord.get('schedule') || '').trim()
  if (!scheduleId) return 0

  let scheduleRecord
  try {
    scheduleRecord = app.findRecordById('report_schedules', scheduleId)
  } catch (_) {
    console.warn('[report_schedule_mailer] schedule not found for job', jobRecord.id)
    return 0
  }

  const recipientIds = parseRecipientIds(scheduleRecord.get('recipient_ids'))
  if (!recipientIds.length) return 0

  const emails = listRecipientEmails(app, jobRecord.get('org'), recipientIds)
  if (!emails.length) {
    console.warn('[report_schedule_mailer] no recipient emails for schedule', scheduleId)
    return 0
  }

  const settings = app.settings()
  const fromAddress = String(settings.meta.senderAddress || '').trim()
  const fromName = String(settings.meta.senderName || 'SiteNook').trim()
  if (!fromAddress) {
    console.warn('[report_schedule_mailer] senderAddress not configured; skipping emails')
    return 0
  }

  const content = buildReportReadyEmail(app, jobRecord, scheduleRecord)
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
      console.warn('[report_schedule_mailer] failed to send to', emails[i], error)
    }
  }
  return sent
}

module.exports = {
  parseRecipientIds,
  listRecipientEmails,
  buildReportReadyEmail,
  notifyReportReady
}
