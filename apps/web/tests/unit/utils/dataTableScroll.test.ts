import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { scrollDataTableIntoView } from '~/utils/dataTableScroll'

describe('scrollDataTableIntoView', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', vi.fn())
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('scrolls to the table surface offset from the viewport top', () => {
    const surface = document.createElement('div')
    surface.className = 'table-surface'
    vi.spyOn(surface, 'getBoundingClientRect').mockReturnValue({
      top: 120,
      left: 0,
      right: 0,
      bottom: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 120,
      toJSON: () => ({})
    })
    Object.defineProperty(window, 'scrollY', { value: 200, configurable: true })

    const root = document.createElement('div')
    root.appendChild(surface)

    scrollDataTableIntoView(root)

    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 304,
      behavior: 'smooth'
    })
  })

  it('no-ops when root is missing', () => {
    scrollDataTableIntoView(null)
    expect(window.scrollTo).not.toHaveBeenCalled()
  })
})
