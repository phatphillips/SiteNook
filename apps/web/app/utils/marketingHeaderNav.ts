export interface MarketingNavLink {
  label: string
  to: string
  description?: string
}

export interface MarketingNavGroup {
  label: string
  items: MarketingNavLink[]
}

/** Centered desktop nav. Cursor-style Product / Resources menus. */
export const MARKETING_NAV_GROUPS: MarketingNavGroup[] = [
  {
    label: 'Product',
    items: [
      {
        label: 'Accessibility',
        to: '/product/accessibility',
        description: 'WCAG scores, trends, and issues'
      },
      {
        label: 'Readability',
        to: '/product/readability',
        description: 'Reading level across your pages'
      },
      {
        label: 'Scanning',
        to: '/product/scanning',
        description: 'Live crawls and scan monitor'
      }
    ]
  },
  {
    label: 'Resources',
    items: [
      {
        label: 'Blog',
        to: '/blog',
        description: 'Product news and guides'
      },
      {
        label: 'Documentation',
        to: '/docs',
        description: 'Setup and how-to reference'
      },
      {
        label: 'Download / Self-host',
        to: '/download',
        description: 'Community Docker and licence keys'
      },
      {
        label: 'Help',
        to: '/help',
        description: 'Support and common questions'
      }
    ]
  }
]
