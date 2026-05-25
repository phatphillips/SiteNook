export interface Policy {
  id: string
  name: string
  rule_type: 'keyword' | 'regex' | 'html_attribute'
  pattern: string
  category: string
  severity: string
  enabled: boolean
}

export interface PolicyMatch {
  policy: string
  matched_text: string
  context: string
  status: string
}

export function runPolicies(html: string, policies: Policy[]): PolicyMatch[] {
  const matches: PolicyMatch[] = []
  const enabled = policies.filter(p => p.enabled)

  for (const policy of enabled) {
    try {
      if (policy.rule_type === 'keyword') {
        const idx = html.toLowerCase().indexOf(policy.pattern.toLowerCase())
        if (idx !== -1) {
          matches.push({
            policy: policy.id,
            matched_text: policy.pattern,
            context: html.slice(Math.max(0, idx - 50), idx + policy.pattern.length + 50),
            status: 'open'
          })
        }
      } else if (policy.rule_type === 'regex') {
        const regex = new RegExp(policy.pattern, 'gi')
        let match
        while ((match = regex.exec(html)) !== null) {
          matches.push({
            policy: policy.id,
            matched_text: match[0],
            context: html.slice(Math.max(0, match.index - 50), match.index + match[0].length + 50),
            status: 'open'
          })
        }
      } else if (policy.rule_type === 'html_attribute') {
        const attrRegex = new RegExp(`\\s${policy.pattern}\\s*=\\s*["'][^"']*["']`, 'gi')
        let match
        while ((match = attrRegex.exec(html)) !== null) {
          matches.push({
            policy: policy.id,
            matched_text: match[0],
            context: match[0],
            status: 'open'
          })
        }
      }
    } catch (err) {
      console.error(`Policy ${policy.name} failed:`, err)
    }
  }

  return matches
}
