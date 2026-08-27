import type { NavigationMenuItem } from '@nuxt/ui'

type NavCloseHandler = () => void

function closeItem(to: string, onClose: NavCloseHandler, exact = false): NavigationMenuItem {
  return { to, exact, onSelect: onClose }
}

export function buildSiteFeatureNavLinks(
  siteId: string,
  routePath: string,
  onClose: NavCloseHandler
): NavigationMenuItem[] {
  const base = `/sites/${siteId}`
  return [{
    label: 'Accessibility',
    icon: 'i-lucide-accessibility',
    defaultOpen: routePath.includes(`${base}/accessibility`),
    type: 'trigger',
    children: [
      { label: 'Overview', ...closeItem(`${base}/accessibility`, onClose, true) },
      { label: 'Issues', ...closeItem(`${base}/accessibility/issues`, onClose) },
      { label: 'Simulator', ...closeItem(`${base}/accessibility/simulator`, onClose) },
      { label: 'Readability', ...closeItem(`${base}/accessibility/readability`, onClose) },
      { label: 'PDFs', ...closeItem(`${base}/accessibility/pdfs`, onClose) }
    ]
  }, {
    label: 'Quality Assurance',
    icon: 'i-lucide-shield-check',
    defaultOpen: routePath.includes(`${base}/qa`),
    type: 'trigger',
    children: [
      { label: 'Overview', ...closeItem(`${base}/qa`, onClose, true) },
      { label: 'Broken Links', ...closeItem(`${base}/qa/links`, onClose) },
      { label: 'Spelling', ...closeItem(`${base}/qa/spelling`, onClose) },
      { label: 'Policies', ...closeItem(`${base}/qa/policies`, onClose) },
      { label: 'Inventory', ...closeItem(`${base}/qa/inventory`, onClose) }
    ]
  }, {
    label: 'SEO',
    icon: 'i-lucide-search',
    defaultOpen: routePath.includes(`${base}/seo`),
    type: 'trigger',
    children: [
      { label: 'Overview', ...closeItem(`${base}/seo`, onClose, true) },
      { label: 'Technical', ...closeItem(`${base}/seo/technical`, onClose) },
      { label: 'Content', ...closeItem(`${base}/seo/content`, onClose) },
      { label: 'Search Result Preview', ...closeItem(`${base}/seo/preview`, onClose) }
    ]
  }]
}

export function buildOrgFeatureNavLinks(
  routePath: string,
  onClose: NavCloseHandler
): NavigationMenuItem[] {
  return [{
    label: 'Accessibility',
    icon: 'i-lucide-accessibility',
    defaultOpen: routePath.startsWith('/accessibility'),
    type: 'trigger',
    children: [
      { label: 'Overview', ...closeItem('/accessibility', onClose, true) },
      { label: 'Issues', ...closeItem('/accessibility/issues', onClose) },
      { label: 'Simulator', ...closeItem('/accessibility/simulator', onClose) },
      { label: 'Readability', ...closeItem('/accessibility/readability', onClose) },
      { label: 'PDFs', ...closeItem('/accessibility/pdfs', onClose) }
    ]
  }, {
    label: 'Quality Assurance',
    icon: 'i-lucide-shield-check',
    defaultOpen: routePath.startsWith('/qa'),
    type: 'trigger',
    children: [
      { label: 'Overview', ...closeItem('/qa', onClose, true) },
      { label: 'Broken Links', ...closeItem('/qa/links', onClose) },
      { label: 'Spelling', ...closeItem('/qa/spelling', onClose) },
      { label: 'Policies', ...closeItem('/qa/policies', onClose) },
      { label: 'Inventory', ...closeItem('/qa/inventory', onClose) }
    ]
  }, {
    label: 'SEO',
    icon: 'i-lucide-search',
    defaultOpen: routePath.startsWith('/seo'),
    type: 'trigger',
    children: [
      { label: 'Overview', ...closeItem('/seo', onClose, true) },
      { label: 'Technical', ...closeItem('/seo/technical', onClose) },
      { label: 'Content', ...closeItem('/seo/content', onClose) },
      { label: 'Search Result Preview', ...closeItem('/seo/preview', onClose) }
    ]
  }]
}

export function isRootOverviewPath(path: string): boolean {
  return path === '/' || /^\/sites\/[^/]+$/.test(path)
}

/** Feature-section overview routes (excludes root dashboard overview). */
export function isFeatureOverviewPath(path: string): boolean {
  return path === '/accessibility'
    || path === '/qa'
    || path === '/seo'
    || path === '/content'
    || /^\/sites\/[^/]+\/(accessibility|qa|seo|content)$/.test(path)
}

export function isOverviewPath(path: string): boolean {
  return isRootOverviewPath(path) || isFeatureOverviewPath(path)
}
