export type WcagVersionTarget = '2.0' | '2.1' | '2.2'
export type WcagConformanceTarget = 'A' | 'AA' | 'AAA'

export interface SiteSettings {
  wcagVersion: WcagVersionTarget
  wcagConformance: WcagConformanceTarget
  ariaConformance: boolean
  bestPractices: boolean
  includeIssues: boolean
  includePotentialIssues: boolean
  checkLinks: boolean
  checkSpelling: boolean
  spellLanguage: string
  checkReadability: boolean
  runPolicies: boolean
  notifyEmail: string | null
  diffFromPrevious: boolean
  depthWeightedScoring: boolean
  checkSeo: boolean
  checkStructuredData: boolean
  seoTitleMinLength: number
  seoTitleMaxLength: number
  seoDescMinLength: number
  seoDescMaxLength: number
  thinContentWordThreshold: number
  lowReadabilityThreshold: number
}

export function getDefaultSiteSettings(): SiteSettings {
  return {
    wcagVersion: '2.2',
    wcagConformance: 'AA',
    ariaConformance: true,
    bestPractices: true,
    includeIssues: true,
    includePotentialIssues: true,
    checkLinks: true,
    checkSpelling: true,
    spellLanguage: 'en-AU',
    checkReadability: true,
    runPolicies: true,
    notifyEmail: null,
    diffFromPrevious: true,
    depthWeightedScoring: false,
    checkSeo: true,
    checkStructuredData: true,
    seoTitleMinLength: 30,
    seoTitleMaxLength: 60,
    seoDescMinLength: 70,
    seoDescMaxLength: 160,
    thinContentWordThreshold: 300,
    lowReadabilityThreshold: 50
  }
}

function siteSettingsFromLegacyScanConfig(raw: unknown): Partial<SiteSettings> {
  if (!raw || typeof raw !== 'object') return {}
  const data = raw as Record<string, unknown>
  const levels = Array.isArray(data.wcagLevels) ? data.wcagLevels as string[] : []
  let wcagConformance: WcagConformanceTarget = 'AA'
  if (levels.includes('AAA')) wcagConformance = 'AAA'
  else if (levels.includes('AA')) wcagConformance = 'AA'
  else if (levels.includes('A')) wcagConformance = 'A'

  return {
    wcagVersion: (data.wcagVersion === '2.0' || data.wcagVersion === '2.1' || data.wcagVersion === '2.2')
      ? data.wcagVersion
      : '2.2',
    wcagConformance,
    ariaConformance: true,
    bestPractices: data.bestPractices !== false,
    includeIssues: true,
    includePotentialIssues: true,
    checkLinks: data.checkLinks !== false,
    checkSpelling: data.checkSpelling !== false,
    spellLanguage: typeof data.spellLanguage === 'string' ? data.spellLanguage : 'en-AU',
    checkReadability: data.checkReadability !== false,
    runPolicies: data.runPolicies !== false,
    notifyEmail: typeof data.notifyEmail === 'string' ? data.notifyEmail : null,
    diffFromPrevious: data.diffFromPrevious !== false
  }
}

export function parseSiteSettings(raw: unknown, legacyScanConfig?: unknown): SiteSettings {
  const defaults = getDefaultSiteSettings()
  const legacy = siteSettingsFromLegacyScanConfig(legacyScanConfig)

  if (!raw || typeof raw !== 'object') {
    return { ...defaults, ...legacy }
  }

  const data = raw as Partial<SiteSettings>
  return {
    ...defaults,
    ...legacy,
    wcagVersion: data.wcagVersion ?? legacy.wcagVersion ?? defaults.wcagVersion,
    wcagConformance: data.wcagConformance ?? legacy.wcagConformance ?? defaults.wcagConformance,
    ariaConformance: data.ariaConformance ?? legacy.ariaConformance ?? defaults.ariaConformance,
    bestPractices: data.bestPractices ?? legacy.bestPractices ?? defaults.bestPractices,
    includeIssues: data.includeIssues ?? defaults.includeIssues,
    includePotentialIssues: data.includePotentialIssues ?? defaults.includePotentialIssues,
    checkLinks: data.checkLinks ?? legacy.checkLinks ?? defaults.checkLinks,
    checkSpelling: data.checkSpelling ?? legacy.checkSpelling ?? defaults.checkSpelling,
    spellLanguage: data.spellLanguage ?? legacy.spellLanguage ?? defaults.spellLanguage,
    checkReadability: data.checkReadability ?? legacy.checkReadability ?? defaults.checkReadability,
    runPolicies: data.runPolicies ?? legacy.runPolicies ?? defaults.runPolicies,
    notifyEmail: data.notifyEmail !== undefined
      ? data.notifyEmail
      : (legacy.notifyEmail ?? defaults.notifyEmail),
    diffFromPrevious: data.diffFromPrevious ?? legacy.diffFromPrevious ?? defaults.diffFromPrevious,
    depthWeightedScoring: data.depthWeightedScoring ?? defaults.depthWeightedScoring,
    checkSeo: data.checkSeo ?? defaults.checkSeo,
    checkStructuredData: data.checkStructuredData ?? defaults.checkStructuredData,
    seoTitleMinLength: data.seoTitleMinLength ?? defaults.seoTitleMinLength,
    seoTitleMaxLength: data.seoTitleMaxLength ?? defaults.seoTitleMaxLength,
    seoDescMinLength: data.seoDescMinLength ?? defaults.seoDescMinLength,
    seoDescMaxLength: data.seoDescMaxLength ?? defaults.seoDescMaxLength,
    thinContentWordThreshold: data.thinContentWordThreshold ?? defaults.thinContentWordThreshold,
    lowReadabilityThreshold: data.lowReadabilityThreshold ?? defaults.lowReadabilityThreshold
  }
}
