#!/usr/bin/env node
/**
 * Minimal Plausible Stats API v2 mock for SiteNook connection testing.
 *
 * Usage (from repo root or apps/web):
 *   node apps/web/scripts/mock-plausible-api.mjs
 *
 * Then in Settings → Integrations → Plausible:
 *   Site domain:  demo.local
 *   API key:      test-key  (any non-empty string)
 *   Instance URL:
 *     - Nuxt on host:     http://127.0.0.1:8791
 *     - Web in Docker:    http://host.docker.internal:8791
 *
 * Optional port: MOCK_PLAUSIBLE_PORT=8791
 */

import { createServer } from 'node:http'

const port = Number(process.env.MOCK_PLAUSIBLE_PORT || 8791)

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://127.0.0.1:${port}`)
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, cors)
    res.end()
    return
  }

  if (req.method === 'POST' && url.pathname === '/api/v2/query') {
    const auth = String(req.headers.authorization || '')
    if (!auth.toLowerCase().startsWith('bearer ') || !auth.slice(7).trim()) {
      res.writeHead(401, { ...cors, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing or invalid Bearer token' }))
      return
    }

    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    let body = {}
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
    } catch {
      body = {}
    }

    const siteId = String(body.site_id || '').trim()
    if (!siteId) {
      res.writeHead(400, { ...cors, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'site_id is required' }))
      return
    }

    console.log(`[mock-plausible] query site_id=${siteId} metrics=${JSON.stringify(body.metrics || [])}`)

    const metrics = Array.isArray(body.metrics) ? body.metrics : ['visitors']
    const values = metrics.map((name) => {
      switch (name) {
        case 'visitors': return 42
        case 'visits': return 55
        case 'pageviews': return 120
        case 'bounce_rate': return 37
        default: return 1
      }
    })

    // Breakdown queries (dimensions) return multiple rows
    if (Array.isArray(body.dimensions) && body.dimensions.length) {
      const dim = body.dimensions[0]
      const rows =
        dim === 'event:page'
          ? [
              { metrics: [40], dimensions: ['/'] },
              { metrics: [30], dimensions: ['/docs'] },
              { metrics: [20], dimensions: ['/pricing'] }
            ]
          : [
              { metrics: [25], dimensions: ['(direct)'] },
              { metrics: [10], dimensions: ['google'] }
            ]
      res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ results: rows }))
      return
    }

    res.writeHead(200, { ...cors, 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ results: [{ metrics: values, dimensions: [] }] }))
    return
  }

  res.writeHead(404, { ...cors, 'Content-Type': 'application/json' })
  res.end(JSON.stringify({ error: `No mock route for ${req.method} ${url.pathname}` }))
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Mock Plausible Stats API listening on http://127.0.0.1:${port}`)
  console.log('POST /api/v2/query  (Authorization: Bearer <any>)')
  console.log('')
  console.log('SiteNook form values:')
  console.log('  Site domain:  demo.local')
  console.log('  API key:      test-key')
  console.log('  Instance URL: http://127.0.0.1:8791  (or http://host.docker.internal:8791 from Docker)')
})
