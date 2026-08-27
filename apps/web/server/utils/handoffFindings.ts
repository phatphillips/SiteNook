import type PocketBase from 'pocketbase'
import { normalizePageUrl } from '~/utils/pageUrl'
import { pbAnd, pbRelation } from '~/utils/pbFilter'
import type { HandoffSectionId } from '~/utils/handoffSectionPrompts'

const FINDINGS_CAP = 20

function escapeFilterValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

async function latestPageIdsByUrl(
  pb: PocketBase,
  siteId: string,
  urls: string[]
): Promise<Map<string, string>> {
  const wanted = new Set(urls.map(normalizePageUrl).filter(Boolean))
  if (!wanted.size) return new Map()

  const pages = await pb.collection('pages').getFullList({
    filter: pbRelation('site', siteId),
    fields: 'id,url,created',
    sort: '-created'
  }) as Array<{ id: string, url?: string }>

  const out = new Map<string, string>()
  for (const page of pages) {
    const key = normalizePageUrl(String(page.url ?? ''))
    if (!wanted.has(key) || out.has(key)) continue
    out.set(key, page.id)
  }
  return out
}

function pageIdFilter(pageIds: string[]): string {
  if (!pageIds.length) return 'id = ""'
  return `(${pageIds.map(id => `page = "${escapeFilterValue(id)}"`).join(' || ')})`
}

export async function loadHandoffFindingsByUrl(
  pb: PocketBase,
  siteId: string,
  section: HandoffSectionId,
  urls: string[]
): Promise<Map<string, string>> {
  const out = new Map<string, string>()
  if (section === 'content' || !urls.length) return out

  const pageByUrl = await latestPageIdsByUrl(pb, siteId, urls)
  const pageIds = [...pageByUrl.values()]
  if (!pageIds.length) return out

  const urlByPageId = new Map([...pageByUrl.entries()].map(([url, id]) => [id, url]))
  const linesByUrl = new Map<string, string[]>()

  const pushLine = (pageId: string, line: string) => {
    const url = urlByPageId.get(pageId)
    if (!url) return
    const list = linesByUrl.get(url) ?? []
    if (list.length >= FINDINGS_CAP) return
    list.push(line)
    linesByUrl.set(url, list)
  }

  if (section === 'accessibility') {
    const issues = await pb.collection('accessibility_issues').getFullList({
      filter: pbAnd([pageIdFilter(pageIds), "status = 'open'"]),
      fields: 'page,rule_id,impact,description,help',
      sort: '-impact'
    }) as Array<{ page?: string, rule_id?: string, impact?: string, description?: string, help?: string }>

    for (const issue of issues) {
      const pageId = String(issue.page ?? '')
      const rule = issue.rule_id || 'issue'
      const impact = issue.impact ? ` (${issue.impact})` : ''
      const detail = (issue.help || issue.description || '').trim()
      pushLine(pageId, `- ${rule}${impact}${detail ? `: ${detail.slice(0, 160)}` : ''}`)
    }
  } else if (section === 'seo') {
    const issues = await pb.collection('seo_issues').getFullList({
      filter: pbAnd([pageIdFilter(pageIds), "status = 'open'"]),
      fields: 'page,rule_id,severity,title,recommendation',
      sort: '-severity'
    }) as Array<{ page?: string, rule_id?: string, severity?: string, title?: string, recommendation?: string }>

    for (const issue of issues) {
      const pageId = String(issue.page ?? '')
      const label = issue.title || issue.rule_id || 'SEO issue'
      const severity = issue.severity ? ` (${issue.severity})` : ''
      const detail = (issue.recommendation || '').trim()
      pushLine(pageId, `- ${label}${severity}${detail ? `: ${detail.slice(0, 160)}` : ''}`)
    }
  } else if (section === 'qa') {
    const [links, spelling, policies] = await Promise.all([
      pb.collection('qa_broken_links').getFullList({
        filter: pbAnd([pageIdFilter(pageIds), "status != 'dismissed'"]),
        fields: 'page,url,status_code,error',
        sort: '-created'
      }) as Promise<Array<{ page?: string, url?: string, status_code?: number, error?: string }>>,
      pb.collection('qa_spelling').getFullList({
        filter: pbAnd([pageIdFilter(pageIds), "status != 'dismissed'"]),
        fields: 'page,word,suggestions',
        sort: '-created'
      }) as Promise<Array<{ page?: string, word?: string, suggestions?: string[] }>>,
      pb.collection('policy_matches').getFullList({
        filter: pageIdFilter(pageIds),
        fields: 'page,matched_text,context',
        sort: '-created'
      }) as Promise<Array<{ page?: string, matched_text?: string, context?: string }>>
    ])

    for (const link of links) {
      const pageId = String(link.page ?? '')
      const code = link.status_code ? ` [${link.status_code}]` : ''
      pushLine(pageId, `- Broken link${code}: ${link.url || 'unknown'}${link.error ? ` (${String(link.error).slice(0, 80)})` : ''}`)
    }
    for (const row of spelling) {
      const pageId = String(row.page ?? '')
      const suggestion = Array.isArray(row.suggestions) && row.suggestions[0] ? ` → ${row.suggestions[0]}` : ''
      pushLine(pageId, `- Spelling: “${row.word || '?'}”${suggestion}`)
    }
    for (const match of policies) {
      const pageId = String(match.page ?? '')
      pushLine(pageId, `- Policy match: “${(match.matched_text || '').slice(0, 80)}”`)
    }
  }

  for (const [url, lines] of linesByUrl) {
    if (lines.length) out.set(url, lines.join('\n'))
  }
  return out
}
