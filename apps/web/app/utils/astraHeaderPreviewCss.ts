/**
 * Astra Header Builder often ships an empty `#ast-desktop-header` and keeps
 * the real chrome in `#ast-mobile-header`. Some sites also raise the JS
 * breakpoint so the mobile wrap stays on at desktop widths.
 *
 * Cloning that chrome into the empty desktop wrap then shows two headers.
 * Hide the empty (or hamburger-cloned) desktop wrap and keep the mobile wrap.
 */
export const ASTRA_EMPTY_DESKTOP_HEADER_CSS = `<style data-accessiq-astra-header>
#ast-desktop-header:not(:has(img)):not(:has(a)):not(:has(nav)):not(:has(.ast-builder-grid-row)):not(:has(.main-header-bar)):not(:has(.site-branding)):not(:has(.ast-builder-menu)),
#ast-desktop-header:has(.main-header-menu-toggle),
#ast-desktop-header:has(.ast-button-wrap .menu-toggle) {
  display: none !important;
}
#masthead:has(#ast-desktop-header:not(:has(img)):not(:has(a)):not(:has(nav)):not(:has(.ast-builder-grid-row)):not(:has(.main-header-bar)):not(:has(.site-branding)):not(:has(.ast-builder-menu))) #ast-mobile-header,
#masthead:has(#ast-desktop-header .main-header-menu-toggle) #ast-mobile-header,
#masthead:has(#ast-desktop-header .ast-button-wrap .menu-toggle) #ast-mobile-header {
  display: block !important;
  height: auto !important;
  max-height: none !important;
  overflow: visible !important;
}
</style>`
