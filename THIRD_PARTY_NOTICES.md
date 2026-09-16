# Third-party notices

SiteNook’s **own source** is MIT ([LICENSE](LICENSE)). Dependencies keep **their own** licences. Using them does not stop you from releasing SiteNook as MIT, as long as you meet each dependency’s terms (usually attribution; some file-level copyleft).

This is an engineering summary, not legal advice. For a commercial product launch, have a lawyer review.

## Compatible with an MIT SiteNook (typical stack)

| Component | Licence (approx.) | Notes |
|-----------|-------------------|--------|
| Nuxt, Vue, Nuxt UI, Tailwind | MIT | Keep copyright notices |
| PocketBase (+ JS SDK) | MIT | |
| Playwright | Apache-2.0 | NOTICE / attribution |
| axe-core / `@axe-core/playwright` | MPL-2.0 | File-level copyleft: you may ship it; modified axe files stay MPL |
| Typesense **JS client** (`typesense` npm) | Apache-2.0 | Fine in MIT apps |
| Stripe Node SDK | Apache-2.0 | Optional; commercial module off by default |
| Most other npm deps | MIT / Apache / BSD / ISC | Standard OSS |

`apps/web/LICENSE` is the **Nuxt UI template** MIT notice, not a second product licence.

## Separate processes / images (not relicensed as MIT)

| Component | Licence | How SiteNook uses it |
|-----------|---------|----------------------|
| **Typesense Server** | **GPL-3.0** | Optional Docker image `typesense/typesense` — not vendored into SiteNook source. Users who enable search run GPL server software next to SiteNook. SiteNook’s MIT code talks to it over HTTP via the Apache client. |
| veraPDF REST | Check upstream | Optional Compose profile `pdf` only |
| OpenDataLoader sidecar | Check upstream | Optional Compose profile `pdf` only |

**Practical rule:** SiteNook can stay **MIT**. Do **not** claim Typesense Server (or other GPL sidecars) are MIT. Do **not** copy Typesense server binaries into this repo. Optional compose profiles already match that model.

## Attribution

Retain upstream copyright and licence files under `node_modules` / Docker image licences. For distributors shipping a binary appliance, generate a full SBOM (e.g. `pnpm licenses` / scanner `npm licenses`) and ship it with the release.
