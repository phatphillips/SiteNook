# Modals

AccessIQ dashboard modals use Nuxt UI `UModal` with a consistent **header**, scrollable **body**, and **footer** action bar. Use this pattern for any new settings or detail dialogs.

## Reference implementations

| Modal | Path | Purpose |
|-------|------|---------|
| **Site settings** | `app/components/sites/SiteSettingsModal.vue` | Site name/URL, reporting accordions, delete/scan/save |
| **Configure scan** | `app/components/shared/ScanConfigModal.vue` | Crawl scope, schedule, browser, auth, advanced |
| **Scan details** | `app/components/scans/ScanDetailModal.vue` | Read-only scan summary with footer actions |

## Layout structure

```vue
<UModal
  v-model:open="open"
  title="Modal title"
  :description="secondary line (e.g. hostname)"
  :ui="{ content: 'sm:max-w-3xl', description: 'text-muted' }"
>
  <template #body>
    <div class="space-y-6 max-h-[70vh] scroll-region">
      <!-- primary fields -->
      <!-- UAccordion sections -->
    </div>
  </template>

  <template #footer>
    <div class="flex w-full items-center justify-between gap-3">
      <!-- destructive / secondary actions (left) -->
      <div class="flex flex-wrap gap-2 justify-end ml-auto">
        <!-- primary actions (right) -->
      </div>
    </div>
  </template>
</UModal>
```

### Header

- **`title`** — short noun phrase (`Site settings`, `Configure Scan`, scan summary title).
- **`description`** — muted secondary line; often the site hostname or timestamp context.
- **Width** — `sm:max-w-3xl` for settings forms; `max-w-2xl` for read-only detail; `sm:max-w-4xl` for large scan config.

### Body

- Wrap content in **`space-y-6`** with **`max-h-[70vh] scroll-region`** so long accordions scroll inside the modal, not the page.
- Optional intro copy: **`text-sm text-muted`** explaining what the modal does.
- **Top fields** (site name, URL) sit **above** accordions when present.
- **Accordions** — `UAccordion` with `type="multiple"`, `:unmount-on-hide="false"`, accordion labels use **`Section  ›  summary`** (see `ScanConfigModal`, `SiteSettingsModal`).
- Section body padding: **`pt-2`** inside each accordion slot.

### Footer

- **Full-width row**: `flex w-full items-center justify-between gap-3`.
- **Left** — destructive or low-frequency actions (e.g. **Delete site**), `variant="outline"`, `color="error"`, **leading icon**.
- **Right** — primary workflow actions grouped in `flex gap-2 justify-end`:
  - Secondary action first (e.g. **Scan** — outline, neutral).
  - Primary action last (e.g. **Save** — solid primary).
- All footer buttons use **leading icons** (`icon="i-lucide-…"` on `UButton`).
- Confirm destructive work in a **nested modal** (see delete confirm in `SiteSettingsModal`), not inline in the footer.

### Nested confirm dialogs

- Separate `UModal` for confirmations (delete site, bulk delete).
- Title + `description` state impact; footer/right-aligned **Cancel** + **Delete** with loading state.

## Accordion summaries

Accordion item labels include a live summary after `›`:

```ts
{ label: `Accessibility  ›  ${accessibilityTargetSummary(settings)}`, value: 'accessibility', slot: 'accessibility' }
```

Keep summaries short (one line); they update as the user edits the form.

## Do not

- Put primary **Save** on the left — primary actions belong on the **right**.
- Omit the footer for editable modals — use header + body + footer consistently.
- Wrap toolbar + table inside the modal body — modals are for forms and detail, not data grids.
- Use chevron-only icon buttons for footer actions — use labeled buttons with leading icons unless space is extremely constrained (table row actions may stay icon-only).

## Related

- [tables.md](./tables.md) — list pages use toolbars outside modals.
- [style-guide.md](./style-guide.md) — tokens, cards, page layout.
- [accessibility-site-target.md](../product/accessibility-site-target.md) — site target fields and scan vs report behaviour.
