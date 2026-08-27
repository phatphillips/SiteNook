import type { ReadabilityMethodId } from '~/utils/readabilityMethods'
import {
  formatReadabilityScore,
  getReadabilityMethod
} from '~/utils/readabilityMethods'
import {
  interpretGradeLevelScore,
  type ReadabilityScoreInterpretation
} from '~/utils/readabilityPageStats'

export interface ReadabilityRewritePromptInput {
  url: string
  title?: string | null
  methodId: ReadabilityMethodId
  score: number | null
}

/** Build a clipboard / chat prompt to rewrite page content for the method's target level. */
export function buildReadabilityRewritePrompt(
  input: ReadabilityRewritePromptInput
): string {
  const method = getReadabilityMethod(input.methodId)
  const url = input.url.trim()
  const title = input.title?.trim()
  const scoreText = formatReadabilityScore(input.score)
  const interpretation = input.score != null
    ? interpretGradeLevelScore(input.methodId, input.score)
    : null

  const lines: string[] = [
    title
      ? `I'm looking at this web page (${title}): ${url}`
      : `I'm looking at this web page: ${url}`,
    '',
    buildScoreLine(method.label, scoreText, interpretation),
    `Target: ${method.bestPractice}`,
    '',
    'Please rewrite the page content so it meets that readability target.',
    'Keep the original meaning, structure, and key facts. Prefer shorter sentences and simpler words where needed.',
    'Return the revised content ready to publish, and briefly note the main readability changes you made.'
  ]

  return lines.join('\n')
}

function buildScoreLine(
  methodLabel: string,
  scoreText: string,
  interpretation: ReadabilityScoreInterpretation | null
): string {
  if (scoreText === '—' || !interpretation) {
    return `It is scored with ${methodLabel}, but no score is available yet.`
  }
  return `It currently scores ${scoreText} on ${methodLabel} (${interpretation.gradeLabel} · ${interpretation.difficulty}).`
}

export function buildChatGptPromptUrl(prompt: string): string {
  return `https://chatgpt.com/?prompt=${encodeURIComponent(prompt)}`
}

export function buildClaudePromptUrl(prompt: string): string {
  return `https://claude.ai/new?q=${encodeURIComponent(prompt)}`
}
