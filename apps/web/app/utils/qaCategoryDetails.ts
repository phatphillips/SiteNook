import type { QaIssueCategoryId } from '~/utils/qaIssueBreakdown'

export interface QaCategoryGuide {
  summary: string
  steps: string[]
  ctaLabel: string
}

const GUIDES: Record<QaIssueCategoryId, QaCategoryGuide> = {
  broken_links: {
    summary:
      'Broken links return errors when visitors or crawlers follow them. They hurt trust, block journeys, and waste crawl budget.',
    steps: [
      'Open the broken links list and confirm each URL still fails.',
      'Replace or remove dead destinations, or restore the missing page.',
      'Prioritize internal links and high-traffic pages first.',
      'Re-scan the site to confirm the count drops.'
    ],
    ctaLabel: 'View broken links'
  },
  misspellings: {
    summary:
      'Misspellings are likely typos and spelling errors detected in page content. Fixing them improves clarity and brand credibility.',
    steps: [
      'Review each flagged word in context on the page.',
      'Correct genuine typos in your CMS or source files.',
      'Add proper nouns or brand terms to your dictionary when they are intentional.',
      'Re-scan after edits to clear resolved findings.'
    ],
    ctaLabel: 'View spelling issues'
  },
  words_to_review: {
    summary:
      'Words to review are terms the spell checker is unsure about. They may be typos, jargon, or valid vocabulary that needs a human check.',
    steps: [
      'Open the spelling view and filter to words needing review.',
      'Confirm each term against the page context.',
      'Fix typos, or accept valid terms into your dictionary.',
      'Keep brand and product names consistent across the site.'
    ],
    ctaLabel: 'Review flagged words'
  },
  policies: {
    summary:
      'Policy matches are places where custom content rules fired. Use them to enforce style, compliance, or brand language standards.',
    steps: [
      'Open each match and read the surrounding content.',
      'Edit the page to satisfy the policy, or update the rule if it is too broad.',
      'Focus on high-severity or high-traffic pages first.',
      'Re-scan to verify matches clear after changes.'
    ],
    ctaLabel: 'View policy matches'
  },
  inventory: {
    summary:
      'Inventory lists assets discovered during the crawl, such as documents and media. It is a catalog, not an issue count.',
    steps: [
      'Browse the inventory to understand what assets are published.',
      'Remove outdated files or orphaned downloads you no longer need.',
      'Check that linked documents are still relevant and accessible.',
      'Use inventory counts as a baseline when planning content cleanup.'
    ],
    ctaLabel: 'Open inventory'
  }
}

export function qaCategoryGuide(id: QaIssueCategoryId): QaCategoryGuide {
  return GUIDES[id]
}
