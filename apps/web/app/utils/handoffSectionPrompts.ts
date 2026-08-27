export type HandoffSectionId = 'content' | 'accessibility' | 'seo' | 'qa'

export interface HandoffSectionPromptState {
  prompt?: string | null
  history?: string[]
}

export type HandoffPromptsRecord = Partial<Record<HandoffSectionId, HandoffSectionPromptState>>

export interface HandoffCommonTask {
  id: string
  title: string
  prompt: string
  icon: string
}

export const HANDOFF_SECTIONS: HandoffSectionId[] = ['content', 'accessibility', 'seo', 'qa']

export const HANDOFF_SECTION_LABELS: Record<HandoffSectionId, string> = {
  content: 'Content',
  accessibility: 'Accessibility',
  seo: 'SEO',
  qa: 'QA'
}

export const HANDOFF_PROMPT_HISTORY_MAX = 10
export const HANDOFF_PROMPT_SOFT_WARN_WORDS = 200
export const HANDOFF_PROMPT_MAX_WORDS = 500

/** System defaults shown when no custom prompt is stored. */
export const HANDOFF_DEFAULT_PROMPTS: Record<HandoffSectionId, string> = {
  content:
    'Rewrite this page for clarity and consistency. Preserve meaning and factual claims, prefer concise headings and scannable paragraphs, and call out gaps or contradictions. Do not invent content the page does not support.',
  accessibility:
    'Remediate accessibility barriers for WCAG 2.2 Level AA on this page. Fix concrete issues in priority order (critical and serious first), prefer semantic HTML editors can ship, and briefly explain each change.',
  seo:
    'Improve on-page SEO for this page. Strengthen the title-worthy opening and headings, reduce thin or duplicate phrasing, and keep changes accurate and brand-safe. Do not invent unsupported claims.',
  qa:
    'Clean quality issues on this page. Fix broken-link and spelling problems where the content allows, tighten inconsistent wording, and flag policy-sensitive phrases. Keep edits minimal and verifiable.'
}

export const HANDOFF_COMMON_TASKS: Record<HandoffSectionId, HandoffCommonTask[]> = {
  content: [
    {
      id: 'content-rewrite-clarity',
      title: 'Rewrite for clarity',
      icon: 'i-lucide-wand-sparkles',
      prompt:
        'Rewrite this page for clarity and scannability. Keep factual meaning, tighten long sentences, improve headings, and align tone with the rest of the site. Return edited content only for this page.'
    },
    {
      id: 'content-merge-site',
      title: 'Merge into another site',
      icon: 'i-lucide-git-merge',
      prompt:
        'Prepare this page to merge into another site. Normalize structure, remove site-specific chrome language, suggest a destination path, and list conflicts or duplicates.'
    }
  ],
  accessibility: [
    {
      id: 'a11y-fix-wcag-aa',
      title: 'Fix WCAG AA issues',
      icon: 'i-lucide-accessibility',
      prompt:
        'Fix WCAG 2.2 Level AA issues on this page. Prioritize critical and serious impacts, and propose concrete markup or content changes.'
    },
    {
      id: 'a11y-prioritise-blockers',
      title: 'Prioritise critical blockers',
      icon: 'i-lucide-octagon-alert',
      prompt:
        'Triage accessibility findings on this page. Rank critical blockers first, group related fixes, and outline a short remediation plan before detailed edits.'
    }
  ],
  seo: [
    {
      id: 'seo-titles-meta',
      title: 'Improve titles & openings',
      icon: 'i-lucide-type',
      prompt:
        'Improve the title-worthy opening and H1/H2 structure for this page. Reduce duplication, keep claims accurate, and note missing SEO signals.'
    },
    {
      id: 'seo-thin-content',
      title: 'Strengthen thin pages',
      icon: 'i-lucide-file-plus',
      prompt:
        'Strengthen thin or vague copy on this page with clearer unique value, better headings, and tighter writing. Do not invent unsupported claims.'
    }
  ],
  qa: [
    {
      id: 'qa-links-spelling',
      title: 'Fix links & spelling',
      icon: 'i-lucide-spell-check',
      prompt:
        'Fix broken links and spelling issues on this page. Prefer verified replacements; flag anything that needs human confirmation.'
    },
    {
      id: 'qa-policy-cleanup',
      title: 'Clean policy-sensitive copy',
      icon: 'i-lucide-shield',
      prompt:
        'Review this page for policy-sensitive or off-brand phrasing. Suggest safe rewrites, keep meaning intact, and list unresolved risks.'
    }
  ]
}

export function isHandoffSectionId(value: unknown): value is HandoffSectionId {
  return typeof value === 'string' && (HANDOFF_SECTIONS as string[]).includes(value)
}

export function countPromptWords(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0
  return trimmed.split(/\s+/).filter(Boolean).length
}

export function clampPromptWords(text: string, maxWords = HANDOFF_PROMPT_MAX_WORDS): string {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length <= maxWords) return text.trim()
  return words.slice(0, maxWords).join(' ')
}

export function promptWordStatus(text: string): {
  words: number
  softWarn: boolean
  overMax: boolean
} {
  const words = countPromptWords(text)
  return {
    words,
    softWarn: words > 0 && words < HANDOFF_PROMPT_SOFT_WARN_WORDS,
    overMax: words > HANDOFF_PROMPT_MAX_WORDS
  }
}

export function parseHandoffPrompts(raw: unknown): HandoffPromptsRecord {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: HandoffPromptsRecord = {}
  for (const section of HANDOFF_SECTIONS) {
    const entry = (raw as Record<string, unknown>)[section]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue
    const promptRaw = (entry as HandoffSectionPromptState).prompt
    const historyRaw = (entry as HandoffSectionPromptState).history
    const prompt = typeof promptRaw === 'string'
      ? promptRaw
      : promptRaw === null
        ? null
        : undefined
    const history = Array.isArray(historyRaw)
      ? historyRaw.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
      : undefined
    out[section] = { prompt, history }
  }
  return out
}

export function resolveActivePrompt(
  stored: HandoffPromptsRecord | null | undefined,
  section: HandoffSectionId
): string {
  const custom = stored?.[section]?.prompt
  if (typeof custom === 'string' && custom.trim()) return custom.trim()
  return HANDOFF_DEFAULT_PROMPTS[section]
}

export function isUsingDefaultPrompt(
  stored: HandoffPromptsRecord | null | undefined,
  section: HandoffSectionId
): boolean {
  const custom = stored?.[section]?.prompt
  return !(typeof custom === 'string' && custom.trim())
}

export function sectionHistory(
  stored: HandoffPromptsRecord | null | undefined,
  section: HandoffSectionId
): string[] {
  const history = stored?.[section]?.history
  if (!Array.isArray(history)) return []
  return history.filter(item => typeof item === 'string' && item.trim().length > 0)
    .slice(0, HANDOFF_PROMPT_HISTORY_MAX)
}

export function pushPromptHistory(
  history: string[] | undefined,
  previousPrompt: string | null | undefined,
  max = HANDOFF_PROMPT_HISTORY_MAX
): string[] {
  const next = [...(history ?? [])]
  const trimmed = typeof previousPrompt === 'string' ? previousPrompt.trim() : ''
  if (!trimmed) return next.slice(0, max)
  if (next[0] === trimmed) return next.slice(0, max)
  return [trimmed, ...next.filter(item => item !== trimmed)].slice(0, max)
}

export function saveSectionPrompt(
  stored: HandoffPromptsRecord | null | undefined,
  section: HandoffSectionId,
  prompt: string
): HandoffPromptsRecord {
  const current = parseHandoffPrompts(stored)
  const previous = current[section]?.prompt
  const trimmed = clampPromptWords(prompt)
  const history = pushPromptHistory(
    current[section]?.history,
    typeof previous === 'string' && previous.trim() ? previous : resolveActivePrompt(current, section)
  )
  return {
    ...current,
    [section]: {
      prompt: trimmed,
      history
    }
  }
}

export function resetSectionPrompt(
  stored: HandoffPromptsRecord | null | undefined,
  section: HandoffSectionId
): HandoffPromptsRecord {
  const current = parseHandoffPrompts(stored)
  const previous = current[section]?.prompt
  const history = pushPromptHistory(
    current[section]?.history,
    typeof previous === 'string' && previous.trim() ? previous : null
  )
  return {
    ...current,
    [section]: {
      prompt: null,
      history
    }
  }
}

export function handoffBannerTitle(section: HandoffSectionId): string {
  return `Define your ${HANDOFF_SECTION_LABELS[section].toLowerCase()} goals`
}

export function matchCommonTask(
  section: HandoffSectionId,
  prompt: string
): HandoffCommonTask | null {
  const trimmed = prompt.trim()
  return HANDOFF_COMMON_TASKS[section].find(task => task.prompt.trim() === trimmed) ?? null
}
