import type { Page } from 'playwright'

export const PRE_AXE_SETTLE_MS = 400
export const FONTS_READY_TIMEOUT_MS = 2000

/**
 * Give late footer / SPA scripts a short window to mutate the DOM before axe.
 * Caps font wait so we never stall on a hanging FontFaceSet.
 */
export async function settlePageForAxe(page: Page): Promise<void> {
  await page.evaluate((fontTimeoutMs) => {
    const fontsReady = document.fonts?.ready ?? Promise.resolve()
    const cap = new Promise<void>(resolve => {
      setTimeout(resolve, fontTimeoutMs)
    })
    return Promise.race([fontsReady.then(() => undefined), cap])
  }, FONTS_READY_TIMEOUT_MS).catch(() => {})

  await page.waitForTimeout(PRE_AXE_SETTLE_MS)
}
