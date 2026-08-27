export interface MarketingFaqItem {
  label: string
  content: string
}

export const LANDING_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    label: 'How does the 30-day Team trial work?',
    content: 'Start with full Team features — scheduled scans, SEO, readability, and up to 10 members — with no credit card. After 30 days, your organization falls back to Free unless you upgrade. Your scan history and first site stay available on Free.'
  },
  {
    label: 'What’s included on Free vs Team?',
    content: 'Free includes 1 site, 20 pages per scan, accessibility and QA checks, and manual scans. Team adds scheduled scans, SEO, readability scoring, more sites and pages, more teammates, and longer history. Business and Enterprise unlock policies, inventory, PDF accessibility, and higher limits.'
  },
  {
    label: 'Do I need to be technical to use SiteNook?',
    content: 'No. Add a site URL, run a scan, and review plain-language findings about barriers that may exclude visitors. Hand issues to content editors or developers when you are ready — invite them from Settings.'
  },
  {
    label: 'What does a scan actually check?',
    content: 'Every scan crawls pages for WCAG accessibility issues (via axe-core), broken links, and spelling. Team and above also unlock SEO checks and readability scoring so you can see how inclusive and findable your content is.'
  },
  {
    label: 'Monthly vs annual — how much do I save?',
    content: 'Annual billing is about 15% less than paying month to month. For example, Team is $99/month or about $84/month when billed annually.'
  },
  {
    label: 'What happens when my trial ends?',
    content: 'If you have not subscribed, SiteNook moves you to Free automatically. Team-only features (SEO, schedules, higher limits) pause until you upgrade. You keep your organization, first site, and recent findings within Free limits.'
  },
  {
    label: 'Can I invite my team / content editors?',
    content: 'Yes. Admins can invite colleagues as admin or viewer. During the Team trial you can invite up to 10 people so content owners and developers can fix issues together.'
  },
  {
    label: 'Is this a replacement for enterprise tools like SiteImprove?',
    content: 'SiteNook covers the same core jobs — accessibility, QA, and SEO monitoring — without the enterprise price tag. Compliance-heavy orgs that need SSO, SLAs, or self-hosted deployment can talk to us about Enterprise.'
  },
  {
    label: 'How is my site data handled?',
    content: 'Hosted plans store crawl results in your SiteNook organization so your team can review and fix issues. Enterprise customers can run SiteNook self-hosted for full data residency control.'
  }
]

export const PRICING_FAQ_ITEMS: MarketingFaqItem[] = [
  {
    label: 'How does the free Team trial work?',
    content: 'Choose Start free trial on Team to get 30 days of Team features with no credit card. When the trial ends you can subscribe (annual saves ~15%) or continue on Free with 1 site and 20 pages per scan.'
  },
  {
    label: 'What is the Free plan limit?',
    content: 'Free includes 1 site, 20 pages per scan, accessibility + QA checks, and manual scans for up to 2 members. It is a lasting safety net after a trial — not a full monitoring substitute for production sites.'
  },
  {
    label: 'Can we pay by purchase order or invoice?',
    content: 'Yes. Education and government buyers often cannot put SaaS on a card. Email our support address from the pricing page with your organisation name and preferred plan. We will arrange invoice or PO billing for Business upgrades and Enterprise agreements.'
  },
  {
    label: 'What happens if we exceed site or page limits?',
    content: 'Scans honour your plan caps (sites, pages per scan, and team members). You will see an upgrade prompt rather than silent overage charges. Move to Team, Business, or talk to us about Enterprise for higher or custom limits.'
  },
  {
    label: 'Why choose annual billing?',
    content: 'Annual plans are billed once per year at a lower monthly equivalent (about 15% savings vs monthly). You can still start with a no-card trial and pick annual when you upgrade.'
  },
  {
    label: 'Can I cancel or downgrade?',
    content: 'Yes. Manage your subscription from Settings → Billing via the Stripe Customer Portal. If you cancel a paid plan, SiteNook keeps a retention window before data purge; Free accounts are not deleted for inactivity alone.'
  },
  {
    label: 'Where is our data stored, and can we keep it in Australia?',
    content: 'Hosted cloud plans store crawl results in your SiteNook organisation for your team to review. Compliance-heavy or AU government buyers who need data residency control can run Enterprise self-hosted in their own environment.'
  },
  {
    label: 'Is SiteNook a Siteimprove alternative?',
    content: 'SiteNook covers the same core jobs — WCAG accessibility, QA (links and spelling), SEO, and multi-site monitoring — at self-serve pricing. Use Enterprise when you need SSO/SAML, invoice billing, SLAs, or self-hosted deployment.'
  },
  {
    label: 'What if I already know I want to pay?',
    content: 'Starter, Team, and Business support Stripe Checkout when you are ready. Prefer annual billing for the best rate. Enterprise is arranged via sales for invoice billing and self-hosted options.'
  }
]
