import { isValidCssSelector } from './cssSelector.js'

export type PolicyKind = 'flag_content' | 'exclude_from_accessibility'

export type PolicyRuleType = 'keyword' | 'regex' | 'html_attribute' | 'css_selector'

export interface Policy {
  id: string
  name: string
  kind?: PolicyKind
  rule_type: PolicyRuleType
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

export function policyKind(policy: Pick<Policy, 'kind'>): PolicyKind {
  return policy.kind === 'exclude_from_accessibility'
    ? 'exclude_from_accessibility'
    : 'flag_content'
}

export function isFlagContentPolicy(policy: Pick<Policy, 'kind' | 'rule_type' | 'enabled'>): boolean {
  if (!policy.enabled) return false
  if (policyKind(policy) !== 'flag_content') return false
  return policy.rule_type === 'keyword'
    || policy.rule_type === 'regex'
    || policy.rule_type === 'html_attribute'
}

export function isExcludeFromAccessibilityPolicy(
  policy: Pick<Policy, 'kind' | 'enabled'>
): boolean {
  return Boolean(policy.enabled) && policyKind(policy) === 'exclude_from_accessibility'
}

/** Split a policy pattern into CSS selectors (newline and/or comma separated). */
export function parseCssExcludeSelectors(pattern: string): string[] {
  const raw = pattern.trim()
  if (!raw) return []

  const parts = raw
    .split(/\n+/)
    .flatMap(line => line.split(','))
    .map(part => part.trim())
    .filter(Boolean)

  return [...new Set(parts)]
}

/** Collect unique valid axe exclude selectors from enabled exclude policies. */
export function axeExcludeSelectorsFromPolicies(policies: Policy[]): string[] {
  const selectors: string[] = []
  const seen = new Set<string>()

  for (const policy of policies) {
    if (!isExcludeFromAccessibilityPolicy(policy)) continue
    for (const selector of parseCssExcludeSelectors(policy.pattern)) {
      if (seen.has(selector)) continue
      seen.add(selector)
      if (!isValidCssSelector(selector)) {
        console.warn(`Skipping invalid axe exclude selector from policy ${policy.name}: ${selector}`)
        continue
      }
      selectors.push(selector)
    }
  }

  return selectors
}

export function runPolicies(html: string, policies: Policy[]): PolicyMatch[] {
  const matches: PolicyMatch[] = []
  const enabled = policies.filter(isFlagContentPolicy)

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
