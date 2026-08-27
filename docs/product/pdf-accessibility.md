# PDF accessibility

SiteNook discovers PDFs during crawls, validates them with **VeraPDF**, extracts structure with **OpenDataLoader**, and exposes a **PDF Inspector** under **Accessibility → PDFs** for each site.

Honest capability envelope:

- Suggested **Tagged PDF** from OpenDataLoader is remediation assist (Apache 2.0).
- **Tagged PDF ≠ certified PDF/UA.** Always re-check with veraPDF.
- PDF/UA-1/2 export remains an enterprise/partner decision.

---

## User flows

| Route | Purpose |
|-------|---------|
| `/sites/:id/accessibility/pdfs` | Library KPIs, upload, unified PDF table (select / rescan / ignore / remove), bulk assisted fix |
| `/sites/:id/accessibility/pdfs/[documentId]` | **PDF Inspector** — Audit / Convert / Compare |
| `/sites/:id/accessibility/pdfs/[documentId]?mode=convert&content=markdown` | Convert deep link (`view2` and legacy `mode=structure` still accepted) |
| `/pdf-report/[token]` | Shareable read-only report (token-gated) |

Breadcrumb chrome: **PDFs / PDF Inspector** (literal slash). The decoded filename appears as a muted subtitle, not the primary title.

### Inspector shell (Audit & Convert)

Unified three-column layout:

| Column | Role |
|--------|------|
| **Pages** | Page thumbnails (pdf.js). Click jumps the preview. Audit may show per-page issue-count badges. |
| **Preview** | PDF preview only (zoom / page chrome). Always PDF — not a free-format pane. |
| **Context** | Mode-specific right pane (see below). |

| Mode | Context pane |
|------|----------------|
| **Audit** | Accessibility issue list + selected issue guidance (how to fix, evidence, go-to-page). Preview shows a page cue when an issue is selected. |
| **Convert** | Copyable extracted content: **Markdown \| HTML \| JSON \| Gutenberg \| Image assets**, with Copy (raw / LLM prompt). Optional structure outline accordion when extraction has items. |
| **Compare** | Original preview + **What improved** assisted-fix summary (metrics, original issue list, remaining work). Optional preview of the fixed PDF. |

Primary CTA: **Generate assisted fix**. Secondary: issue CSV, remediation pack ZIP, share.

---

## Scanner pipeline

| Stage | Module | Role |
|-------|--------|------|
| Discovery | Crawl + `enqueueCrawlPdfs.ts` | Queue PDF URLs |
| Validation | `validatePdfDocument.ts` + `veraPdfClient.ts` | VeraPDF UA-1 → `pdf_issues` |
| Structure | `extractPdfStructure.ts` + `opendataloaderClient.ts` | ODL `json,html,markdown` artifacts |
| Remediate | `remediatePdfDocument.ts` | ODL `tagged-pdf` → artifact → re-validate → delta |
| Queues | `pdfValidationWorker.ts`, `pdfRemediationWorker.ts` | Poll `pdf_validation_queue` / `pdf_remediation_queue` |
| Packs | `exportRemediationPack.ts` + web `/remediation-pack` | ZIP for agencies |

Sidecars (Docker): `verapdf`, `opendataloader` (`OPENDATALOADER_URL`).

---

## Data model

| Collection | Role |
|------------|------|
| `pdf_documents` | Document + structure fields + remediation status; `ignored` skips auto-scan on future crawls |
| `pdf_issues` | VeraPDF findings |
| `pdf_validation_queue` | Validation jobs |
| `pdf_remediations` | Suggested Tagged PDF artifacts + before/after metrics |
| `pdf_remediation_queue` | Structure + remediate jobs |

---

## Exports

| Export | Contents |
|--------|----------|
| Document CSV | Library summary (existing) |
| Issue CSV | Per-issue remediation rows + guidance |
| Structure JSON/HTML/MD | ODL inspection outputs |
| Remediation pack ZIP | Original + suggested + structure + issues CSV + summary |
| Bulk suggest | Library action for unscored/complete docs |

---

## Preview troubleshooting

Preview loads via Nuxt proxy `GET /api/pdf-documents/:id/file` (auth required), then **pdf.js** in the browser. There is no separate preview microservice.

| Symptom | Likely cause | What to do |
|---------|--------------|------------|
| `Preview server error (502)` / crawl fetch failed | Document still has no stored `file`; web proxy fell back to the remote URL | Wait for the scanner (next scan or validation poll backfill), or upload a copy |
| `403` / blocked | Crawl host or PB refused the fetch | Upload a copy of the PDF |
| `401` / sign in again | Auth token missing or expired | Sign in again |
| Thumbs empty + preview error | Same source failure — thumbnails share the preview buffer | Fix the source first; thumbs appear after a successful load |

**Automatic store:** On crawl discover (`enqueueCrawlPdfs`), search indexing, validation, structure, and remediation, the scanner downloads the PDF and saves it to `pdf_documents.file` when missing. A validation-queue idle backfill also stores remaining crawl docs without a file.

---

## How to verify

After stack is up (`docker compose` with veraPDF + OpenDataLoader):

1. Open `/sites/:id/accessibility/pdfs` → upload fixture `tests/fixtures/pdfs/untagged-simple.pdf`
2. Wait until validation completes → **Audit** shows Pages thumbnails, Preview, and Issues context
3. Open **Convert** → Preview stays PDF; Content defaults to Markdown (or HTML); switch JSON / Gutenberg / Image assets; use **Copy**
4. Click a page thumbnail → Preview jumps to that page
5. Click **Generate suggested tags** → job completes → original unchanged; suggested file downloadable
6. Open **Compare** → before/after score/issue delta visible
7. Download **issue CSV** and **remediation pack ZIP**
8. Deep-link `?mode=convert&content=markdown` restores Convert content format (`view2` and `mode=structure` still work)

### Automated

```bash
# Scanner unit remediator suite (+ optional live ODL)
cd apps/scanner && npm run test:pdf-remediation
# Live ODL smoke (optional):
# PDF_REMEDIATION_LIVE=1 OPENDATALOADER_URL=http://localhost:8095 npm run test:pdf-remediation

cd apps/web && npm test -- tests/unit/utils/pdfRemediationStudio.test.ts
```

Spike notes: [architecture/pdf-remediation-spike.md](../architecture/pdf-remediation-spike.md)

---

## Known gaps

| Gap | Notes |
|-----|-------|
| **CMS pre-publish** | No Drupal/AEM plugin |
| **Enterprise PDF/UA export** | Not in OSS path |
| **In-app tag editor** | Out of scope (use Acrobat/PAC or partner studio) |
| **VeraPDF / ODL offline** | Jobs fail closed — monitor sidecars |
| **Large PDF limits** | 20MB cap (`ODL_MAX_BYTES` / download limit) |

---

## Related

- [product/global-search.md](./global-search.md) — PDF body text in search index
- [product/scans.md](./scans.md) — crawl discovers PDF links
- [design/ui-dictionary.md](../design/ui-dictionary.md) — PDF Inspector UI names
