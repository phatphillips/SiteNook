/** Scroll a data-table panel so the table header is visible after pagination. */
export function scrollDataTableIntoView(root: HTMLElement | null | undefined) {
  if (typeof window === 'undefined' || !root) return
  const surface = root.querySelector<HTMLElement>('.table-surface') ?? root
  const top = surface.getBoundingClientRect().top + window.scrollY - 16
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}
