/**
 * Fallback axe-core check catalog (WCAG + best-practice tags).
 * Used when a scan has no persisted a11y_check_stats.
 * Generated from axe-core 4.11.4.
 */
import type { A11yCheckCatalogEntry } from './a11yCheckStats.js'

export const FALLBACK_AXE_CATALOG: readonly A11yCheckCatalogEntry[] = [
  {
    rule_id: "accesskeys",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "area-alt",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-allowed-attr",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-allowed-role",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "aria-braille-equivalent",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-command-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-conditional-attr",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-deprecated-role",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-dialog-name",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "aria-hidden-body",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-hidden-focus",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-input-field-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-meter-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-progressbar-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-prohibited-attr",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-required-attr",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-required-children",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-required-parent",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-roledescription",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-roles",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-text",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "aria-toggle-field-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-tooltip-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-treeitem-name",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "aria-valid-attr-value",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "aria-valid-attr",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "audio-caption",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "autocomplete-valid",
    wcag_level: 'AA',
    is_best_practice: false
  },
  {
    rule_id: "avoid-inline-spacing",
    wcag_level: 'AA',
    is_best_practice: false
  },
  {
    rule_id: "blink",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "button-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "bypass",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "color-contrast-enhanced",
    wcag_level: 'AAA',
    is_best_practice: false
  },
  {
    rule_id: "color-contrast",
    wcag_level: 'AA',
    is_best_practice: false
  },
  {
    rule_id: "css-orientation-lock",
    wcag_level: 'AA',
    is_best_practice: false
  },
  {
    rule_id: "definition-list",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "dlitem",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "document-title",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "duplicate-id-aria",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "empty-heading",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "empty-table-header",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "focus-order-semantics",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "form-field-multiple-labels",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "frame-focusable-content",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "frame-tested",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "frame-title-unique",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "frame-title",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "heading-order",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "hidden-content",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "html-has-lang",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "html-lang-valid",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "html-xml-lang-mismatch",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "identical-links-same-purpose",
    wcag_level: 'AAA',
    is_best_practice: false
  },
  {
    rule_id: "image-alt",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "image-redundant-alt",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "input-button-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "input-image-alt",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "label-content-name-mismatch",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "label-title-only",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "label",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "landmark-banner-is-top-level",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "landmark-complementary-is-top-level",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "landmark-contentinfo-is-top-level",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "landmark-main-is-top-level",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "landmark-no-duplicate-banner",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "landmark-no-duplicate-contentinfo",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "landmark-no-duplicate-main",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "landmark-one-main",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "landmark-unique",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "link-in-text-block",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "link-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "list",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "listitem",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "marquee",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "meta-refresh-no-exceptions",
    wcag_level: 'AAA',
    is_best_practice: false
  },
  {
    rule_id: "meta-refresh",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "meta-viewport-large",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "meta-viewport",
    wcag_level: 'AA',
    is_best_practice: false
  },
  {
    rule_id: "nested-interactive",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "no-autoplay-audio",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "object-alt",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "p-as-heading",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "page-has-heading-one",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "presentation-role-conflict",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "region",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "role-img-alt",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "scope-attr-valid",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "scrollable-region-focusable",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "select-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "server-side-image-map",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "skip-link",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "summary-name",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "svg-img-alt",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "tabindex",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "table-duplicate-name",
    wcag_level: 'AA',
    is_best_practice: true
  },
  {
    rule_id: "table-fake-caption",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "target-size",
    wcag_level: 'AA',
    is_best_practice: false
  },
  {
    rule_id: "td-has-header",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "td-headers-attr",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "th-has-data-cells",
    wcag_level: 'A',
    is_best_practice: false
  },
  {
    rule_id: "valid-lang",
    wcag_level: 'AA',
    is_best_practice: false
  },
  {
    rule_id: "video-caption",
    wcag_level: 'A',
    is_best_practice: false
  }
] as const
