import type { Policy } from '~/types/sitenook'

export type PolicyKind = Policy['kind']

/** Presets for exclude_from_accessibility policies (CSS selectors, one per line). */
export const A11Y_EXCLUDE_PRESETS: Array<{ label: string, description: string, pattern: string }> = [
  {
    label: 'YouTube embeds',
    description: 'Skip axe checks on YouTube iframe embeds',
    pattern: [
      'iframe[src*="youtube.com"]',
      'iframe[src*="youtube-nocookie.com"]',
      'iframe[src*="youtu.be"]'
    ].join('\n')
  },
  {
    label: 'Common embeds',
    description: 'YouTube, Vimeo, and similar third-party players',
    pattern: [
      'iframe[src*="youtube.com"]',
      'iframe[src*="youtube-nocookie.com"]',
      'iframe[src*="youtu.be"]',
      'iframe[src*="vimeo.com"]',
      'iframe[src*="player.vimeo.com"]',
      'iframe[src*="dailymotion.com"]',
      'iframe[src*="wistia.com"]',
      'iframe[src*="wistia.net"]'
    ].join('\n')
  },
  {
    label: 'All iframes',
    description: 'Exclude every iframe element from accessibility checks',
    pattern: 'iframe'
  }
]

export function policyKindLabel(kind: PolicyKind | undefined): string {
  return kind === 'exclude_from_accessibility' ? 'Exclude from a11y' : 'Flag content'
}

export function isExcludePolicy(policy: Pick<Policy, 'kind'>): boolean {
  return policy.kind === 'exclude_from_accessibility'
}
