# PDF accessibility

AccessIQ discovers PDFs during crawls, validates them with **VeraPDF**, and exposes results under **Accessibility → PDFs** for each site.

---

## User flows

| Route | Purpose |
|-------|---------|
| `/sites/:id/accessibility/pdfs` | Validated PDFs table, upload panel |
| `/sites/:id/accessibility/pdfs/[documentId]` | Issue sidebar + preview for one PDF |
| `/sites/:id/accessibility/pdfs/validate` | Manual upload validation |
| `/sites/:id/accessibility/pdfs/audit` | Audit-oriented view |
| `/pdf-report/[token]` | Shareable read-only report (token-gated) |

PDFs also appear in **Global search** when indexed (`product/global-search.md`).

---

## Scanner pipeline

| Stage | Module | Role |
|-------|--------|------|
| Discovery | Crawl link extraction + `enqueueCrawlPdfs.ts` | Queue PDF URLs found on pages |
| Download | `pdf/pdfDownload.ts` | Fetch with browser profile / retries |
| Metadata | `pdf/extractPdfMetadata.ts` | Author, title, subject, keywords |
| Validation | `pdf/validatePdfDocument.ts` + `veraPdfClient.ts` | VeraPDF API, map to issues |
| Search index | `pdf/indexPdfSearchContent.ts` | Extract text → Typesense |

VeraPDF runs as a separate service (see `docker-compose.yml`). Scanner env: `VERAPDF_*` URLs and timeouts.

---

## Data model

| Collection | Role |
|------------|------|
| `pdf_documents` | One row per PDF URL per site; status, metadata, `text_content` |
| `pdf_issues` | VeraPDF rule findings linked to document + scan |

---

## Key web files

| Component | Path |
|-----------|------|
| PDF table | `components/accessibility/pdf/ValidatedPdfsTable.vue` |
| Issue panels | `PdfIssueSidebar.vue`, `PdfIssueDetailPanel.vue` |
| Preview | `PdfPreviewViewer.vue` |
| Upload | `PdfUploadPanel.vue` |

---

## Known gaps

| Gap | Notes |
|-----|-------|
| **CMS pre-publish** | No Drupal/AEM plugin; upload is manual or crawl-discovered only |
| **Bulk remediation export** | No packaged PDF remediation report beyond per-document view |
| **VeraPDF offline** | Validation fails closed when VeraPDF service unreachable — monitor in ops |
| **Large PDF limits** | Very large files may timeout; size caps in scanner config |

---

## Related

- [product/global-search.md](./global-search.md) — PDF body text in search index
- [product/scans.md](./scans.md) — crawl discovers PDF links
- [archive/project-brief.md](../archive/project-brief.md) — original PDF tagging requirements (historical)
