function extractActionUrl(e) {
  const html = String(e.message.html || '')
  const text = String(e.message.text || '')
  const htmlMatch = html.match(/href="([^"]+)"/)
  if (htmlMatch && htmlMatch[1]) {
    return htmlMatch[1]
  }
  const textMatch = text.match(/https?:\/\/[^\s]+/)
  if (textMatch && textMatch[0]) {
    return textMatch[0]
  }
  return ''
}

function appendSetupParam(url) {
  if (!url || url.indexOf('setup=1') !== -1) {
    return url
  }
  return url.indexOf('?') === -1 ? url + '?setup=1' : url + '&setup=1'
}

function buildTenantOrigin(dashboardUrl, subdomain, appDomain) {
  const slug = String(subdomain || '').trim().toLowerCase()
  if (!slug) return dashboardUrl

  const domain = String(appDomain || 'localhost').trim().toLowerCase()
  if (domain === 'localhost') {
    let port = ':3000'
    const portMatch = dashboardUrl.match(/:(\d+)$/)
    if (portMatch) {
      port = ':' + portMatch[1]
    }
    const protocol = dashboardUrl.startsWith('https') ? 'https' : 'http'
    return protocol + '://' + slug + '.localhost' + port
  }

  const protocol = dashboardUrl.startsWith('https') ? 'https' : 'http'
  return protocol + '://' + slug + '.' + domain
}

module.exports = {
  extractActionUrl,
  appendSetupParam,
  buildTenantOrigin
}
