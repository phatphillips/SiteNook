export const PDF_CONVERT_LLM_PROMPT_STORAGE_KEY = 'sitenook.pdfConvert.llmPrompt'

export const PDF_CONVERT_LLM_PROMPT = `You are helping clean up extracted document content for publishing.

Rules:
- Retain the document's meaning, content, and structure (headings, lists, tables, reading order).
- Clean up formatting noise, broken lines, and OCR/extraction artifacts.
- Do not invent sections, facts, or links that are not present.
- Return only the cleaned content in the same format as the input.

---

`

export function readLlmPromptEnabled(): boolean {
  if (!import.meta.client) return false
  try {
    return localStorage.getItem(PDF_CONVERT_LLM_PROMPT_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeLlmPromptEnabled(enabled: boolean) {
  if (!import.meta.client) return
  try {
    localStorage.setItem(PDF_CONVERT_LLM_PROMPT_STORAGE_KEY, enabled ? '1' : '0')
  } catch {
    // Ignore quota / private mode.
  }
}

/** Build clipboard payload for Convert pane copy. */
export function buildPdfConvertClipboardText(
  content: string,
  includeLlmPrompt: boolean
): string {
  const body = content?.trim() ?? ''
  if (!body) return ''
  if (!includeLlmPrompt) return body
  return `${PDF_CONVERT_LLM_PROMPT}${body}`
}
