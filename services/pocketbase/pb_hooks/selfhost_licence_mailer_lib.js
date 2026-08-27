/**
 * Email Self-host licence keys (called from Nitro after Stripe checkout).
 * Requires PocketBase SMTP in Settings → Mail settings.
 */
function sendLicenceMail(app, email, licenceKey, expiresAt) {
  const to = String(email || '').trim().toLowerCase()
  const key = String(licenceKey || '').trim()
  if (!to || !key) return 0

  const settings = app.settings()
  const fromAddress = String(settings.meta.senderAddress || '').trim()
  const fromName = String(settings.meta.senderName || 'SiteNook').trim()
  if (!fromAddress) {
    console.warn('[selfhost_licence_mailer] senderAddress not configured; skipping')
    return 0
  }

  const appName = String($os.getenv('APP_NAME') || 'SiteNook').trim() || 'SiteNook'
  const supportEmail = String($os.getenv('NUXT_PUBLIC_SUPPORT_EMAIL') || 'contact@your-org.com').trim()
  const downloadUrl = String($os.getenv('APP_DASHBOARD_URL') || 'http://localhost:3000').replace(/\/$/, '') + '/download'

  const subject = 'Your ' + appName + ' Self-host licence key'
  const text = [
    'Thanks for purchasing ' + appName + ' Self-host.',
    '',
    'Licence key: ' + key,
    'Expires: ' + (expiresAt || 'see your subscription'),
    '',
    'Add this to your appliance .env:',
    '',
    'SITENOOK_DEPLOYMENT_MODE=appliance',
    'SITENOOK_LICENCE_KEY=' + key,
    'SITENOOK_LICENCE_SERVER_URL=' + String($os.getenv('APP_DASHBOARD_URL') || 'https://sitenook.com').replace(/\/$/, ''),
    '',
    'Install guide: ' + downloadUrl,
    '',
    'Questions? ' + supportEmail,
    '',
    '— ' + appName
  ].join('\n')

  const html = '<p>Thanks for purchasing <strong>' + appName + ' Self-host</strong>.</p>'
    + '<p><strong>Licence key:</strong> <code>' + key + '</code></p>'
    + '<p>Expires: ' + (expiresAt || 'see your subscription') + '</p>'
    + '<p>Install guide: <a href="' + downloadUrl + '">' + downloadUrl + '</a></p>'
    + '<p>Questions? <a href="mailto:' + supportEmail + '">' + supportEmail + '</a></p>'

  try {
    const message = new MailerMessage({
      from: { address: fromAddress, name: fromName },
      to: [{ address: to }],
      subject,
      html,
      text
    })
    app.newMailClient().send(message)
    return 1
  } catch (err) {
    console.error('[selfhost_licence_mailer] send failed', err)
    return 0
  }
}

module.exports = {
  sendLicenceMail
}
