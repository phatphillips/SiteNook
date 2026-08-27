#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { SiteNookApiError, loadClientFromEnv } from './client.js'

function textResult(data: unknown) {
  return {
    content: [
      {
        type: 'text' as const,
        text: typeof data === 'string' ? data : JSON.stringify(data, null, 2)
      }
    ]
  }
}

function errorResult(error: unknown) {
  const message = error instanceof SiteNookApiError
    ? `SiteNook API ${error.status}: ${error.message}`
    : error instanceof Error
      ? error.message
      : String(error)
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true as const
  }
}

async function main() {
  const client = loadClientFromEnv()
  const server = new McpServer({
    name: 'sitenook',
    version: '0.1.0'
  })

  server.tool(
    'list_sites',
    'List SiteNook sites in the authenticated organization',
    {},
    async () => {
      try {
        return textResult(await client.listSites())
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.tool(
    'get_site',
    'Get details for one SiteNook site by id',
    { siteId: z.string().describe('Site record id') },
    async ({ siteId }) => {
      try {
        return textResult(await client.getSite(siteId))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.tool(
    'enqueue_scan',
    'Queue a crawl/scan for a site (requires write-scoped API key)',
    {
      siteId: z.string(),
      scanType: z.enum(['full', 'accessibility_only', 'qa_only']).optional()
    },
    async ({ siteId, scanType }) => {
      try {
        return textResult(await client.enqueueScan(siteId, scanType))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.tool(
    'get_scan_status',
    'Get recent scan_queue items and scans for a site',
    { siteId: z.string() },
    async ({ siteId }) => {
      try {
        return textResult(await client.getScanStatus(siteId))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.tool(
    'cancel_scan',
    'Cancel a pending/processing scan_queue item or running scan by id',
    { id: z.string().describe('scan_queue id or scans id') },
    async ({ id }) => {
      try {
        return textResult(await client.cancelScan(id))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.tool(
    'list_accessibility_issues',
    'List accessibility issues for a site (supports severity/status filters via query params used by the dashboard)',
    {
      siteId: z.string(),
      page: z.number().int().positive().optional(),
      perPage: z.number().int().positive().max(100).optional(),
      severity: z.string().optional(),
      status: z.string().optional()
    },
    async ({ siteId, page, perPage, severity, status }) => {
      try {
        return textResult(await client.listAccessibilityIssues(siteId, {
          page,
          perPage,
          severity,
          status
        }))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.tool(
    'list_qa_issues',
    'List QA issues (broken links, spelling, or policy matches) for a site',
    {
      siteId: z.string(),
      type: z.enum(['broken_links', 'spelling', 'policy_matches']).default('broken_links'),
      page: z.number().int().positive().optional(),
      perPage: z.number().int().positive().max(100).optional()
    },
    async ({ siteId, type, page, perPage }) => {
      try {
        return textResult(await client.listQaIssues(siteId, type, page, perPage))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.tool(
    'update_qa_status',
    'Bulk dismiss/reopen/fix QA issues (requires write scope)',
    {
      siteId: z.string(),
      issueIds: z.array(z.string()).min(1),
      issueType: z.enum(['broken_links', 'spelling', 'policy_matches']),
      action: z.enum(['dismiss', 'reopen', 'fixed'])
    },
    async ({ siteId, issueIds, issueType, action }) => {
      try {
        return textResult(await client.updateQaStatus(siteId, issueIds, issueType, action))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  server.tool(
    'search_content',
    'Search crawled site content via SiteNook global search (Typesense). Returns 503 if search is disabled.',
    {
      q: z.string().min(1),
      siteId: z.string().optional(),
      mode: z.string().optional(),
      type: z.string().optional(),
      page: z.number().int().positive().optional()
    },
    async ({ q, siteId, mode, type, page }) => {
      try {
        return textResult(await client.searchContent(q, { siteId, mode, type, page }))
      } catch (error) {
        return errorResult(error)
      }
    }
  )

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
