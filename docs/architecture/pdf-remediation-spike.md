# Phase 0 — PDF remediation spike notes

**Date:** 2026-07-14  
**Decision:** **Go** for Phase 1 (demo-parity Structure Inspector + suggested Tagged PDF + veraPDF re-check).

## Evaluation summary

| Criteria | Finding | Threshold | Result |
|----------|---------|-----------|--------|
| Structure JSON / HTML / MD usable for dual-pane | ODL `format=json,html,markdown` exposes headings, paragraphs, tables, lists with bboxes in JSON | Usable on ≥70% of sample shapes | Pass (fixture set covers simple / table / tagged) |
| Auto-tag lift vs veraPDF UA-1 | Untagged docs typically gain tags; veraPDF open-issue count expected to drop after `tagged-pdf` | Measurable reduction on untagged fixtures | Pass for go; calibrate median % in ops after first prod samples |
| Runtime / memory | Sidecar is CLI-in-container HTTP wrapper; batch one convert call per doc | Failures quarantined; size capped at 20MB | Acceptable for MVP |
| Bbox overlay | JSON `[left, bottom, right, top]` in PDF points maps to pdf.js viewport | Click → highlight | Pass |

## Fixture set locked for CI / smoke

| Fixture | Role |
|---------|------|
| `tests/fixtures/pdfs/untagged-simple.pdf` | Happy path |
| `tests/fixtures/pdfs/tagged-basic.pdf` | Already-tagged / low-change |
| `tests/fixtures/pdfs/table-heavy.pdf` | Tables / reading order |
| `tests/fixtures/pdfs/corrupt.pdf` | Failure UX |
| `tests/fixtures/pdfs/golden/*` | Expected element types / HTML snippets |

## Go / no-go

- **Go:** Ship Remediation Studio Phase 1 with ODL sidecar.
- Product copy must keep **Tagged PDF ≠ PDF/UA** language.
- Enterprise PDF/UA export remains Phase 4 / commercial.
