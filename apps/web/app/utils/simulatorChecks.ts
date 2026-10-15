/** Vision / keyboard simulation checks for the Accessibility Simulator. */

export const SIMULATOR_VISION_IDS = [
  'none',
  'protanopia',
  'deuteranopia',
  'tritanopia',
  'achromatopsia',
  'low_vision',
  'cataracts',
  'tunnel_vision'
] as const

export type SimulatorVisionId = typeof SIMULATOR_VISION_IDS[number]

export interface SimulatorCheckMeta {
  id: SimulatorVisionId | 'tab_order'
  label: string
  shortLabel: string
  description: string
  /** External article for “Learn more” (Wikipedia or similar). */
  learnMoreUrl?: string
  /** CSS filter applied to the preview wrapper (empty for none / overlay-only). */
  cssFilter: string
  /** Extra overlay class on the preview (e.g. vignette). */
  overlayClass?: string
  /** Independent of vision modes. Can combine. */
  independent?: boolean
}

/**
 * Pure CSS filters only (no SVG `url(#…)`).
 * SVG filter refs often invalidate the whole `filter` chain, and parent-wrapper
 * filters frequently do not paint onto iframe snapshot content.
 */
export const SIMULATOR_CHECKS: SimulatorCheckMeta[] = [
  {
    id: 'none',
    label: 'No simulation',
    shortLabel: 'None',
    description: 'View the crawl screenshot without vision filters.',
    cssFilter: ''
  },
  {
    id: 'protanopia',
    label: 'Protanopia',
    shortLabel: 'Protanopia',
    description:
      'Red-blind colour vision. Reds look darker and are hard to tell apart from greens and browns. Contrast that relies on red alone often fails.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Dichromacy#Protanopia',
    cssFilter: 'grayscale(0.35) sepia(0.55) hue-rotate(-25deg) saturate(1.35) contrast(0.95)'
  },
  {
    id: 'deuteranopia',
    label: 'Deuteranopia',
    shortLabel: 'Deuteranopia',
    description:
      'Green-blind colour vision (the most common CVD). Greens and reds conflate; status colours and charts that encode meaning only in hue become ambiguous.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Dichromacy#Deuteranopia',
    cssFilter: 'grayscale(0.3) sepia(0.45) hue-rotate(20deg) saturate(1.25) contrast(0.95)'
  },
  {
    id: 'tritanopia',
    label: 'Tritanopia',
    shortLabel: 'Tritanopia',
    description:
      'Blue-yellow colour blindness. Blues and yellows are hard to distinguish; cool UI accents and warning yellows can blend into surrounding greys.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Dichromacy#Tritanopia',
    cssFilter: 'hue-rotate(195deg) saturate(0.65) contrast(1.05) brightness(1.05)'
  },
  {
    id: 'achromatopsia',
    label: 'Achromatopsia',
    shortLabel: 'Grayscale',
    description:
      'Complete colour blindness. The page is seen only in shades of grey. Any information conveyed by colour alone is lost.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Achromatopsia',
    cssFilter: 'grayscale(1) contrast(1.05)'
  },
  {
    id: 'low_vision',
    label: 'Low vision',
    shortLabel: 'Low vision',
    description:
      'Reduced acuity and soft focus. Small text, thin icons, and low-contrast UI become difficult without magnification or stronger contrast.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Low_vision',
    cssFilter: 'blur(2.5px) contrast(0.85) brightness(1.05)'
  },
  {
    id: 'cataracts',
    label: 'Cataracts',
    shortLabel: 'Cataracts',
    description:
      'Cloudy, washed-out vision with glare. Fine detail disappears and light backgrounds can overwhelm content.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Cataract',
    cssFilter: 'blur(4px) brightness(1.25) contrast(0.7) saturate(0.6)'
  },
  {
    id: 'tunnel_vision',
    label: 'Tunnel vision',
    shortLabel: 'Tunnel vision',
    description:
      'Severely reduced peripheral vision. Only the centre of the viewport is clear. Layout that places key actions at the edges is easy to miss.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Tunnel_vision',
    cssFilter: '',
    overlayClass: 'simulator-overlay--tunnel'
  },
  {
    id: 'tab_order',
    label: 'Tab order',
    shortLabel: 'Tab order',
    description:
      'Shows the keyboard tab sequence as numbered badges on focusable controls. Gaps, traps, and illogical order become visible at a glance.',
    learnMoreUrl: 'https://en.wikipedia.org/wiki/Focus_(computing)#Keyboard_focus',
    cssFilter: '',
    independent: true
  }
]

const checkById = new Map(SIMULATOR_CHECKS.map(c => [c.id, c]))

export function getSimulatorCheck(id: SimulatorCheckMeta['id']): SimulatorCheckMeta {
  const meta = checkById.get(id)
  if (!meta) throw new Error(`Unknown simulator check: ${id}`)
  return meta
}

export function getVisionChecks(): SimulatorCheckMeta[] {
  return SIMULATOR_CHECKS.filter(c => !c.independent)
}

export function getIndependentChecks(): SimulatorCheckMeta[] {
  return SIMULATOR_CHECKS.filter(c => c.independent)
}

/** CSS filter string for a vision mode (empty when none / overlay-only). */
export function visionCssFilter(visionId: SimulatorVisionId): string {
  return getSimulatorCheck(visionId).cssFilter
}

export function visionOverlayClass(visionId: SimulatorVisionId): string | undefined {
  return getSimulatorCheck(visionId).overlayClass
}

/** SVG filter defs for CVD matrices (inject once into the preview document). */
export const SIMULATOR_CVD_SVG_FILTERS = `
<svg xmlns="http://www.w3.org/2000/svg" width="0" height="0" aria-hidden="true" style="position:absolute">
  <defs>
    <filter id="sim-protanopia">
      <feColorMatrix type="matrix" values="
        0.567 0.433 0 0 0
        0.558 0.442 0 0 0
        0 0.242 0.758 0 0
        0 0 0 1 0"/>
    </filter>
    <filter id="sim-deuteranopia">
      <feColorMatrix type="matrix" values="
        0.625 0.375 0 0 0
        0.7 0.3 0 0 0
        0 0.3 0.7 0 0
        0 0 0 1 0"/>
    </filter>
    <filter id="sim-tritanopia">
      <feColorMatrix type="matrix" values="
        0.95 0.05 0 0 0
        0 0.433 0.567 0 0
        0 0.475 0.525 0 0
        0 0 0 1 0"/>
    </filter>
  </defs>
</svg>
`.trim()
