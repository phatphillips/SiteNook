# PDF remediation fixtures

| File | Purpose |
|------|---------|
| `untagged-simple.pdf` | Happy-path structure + suggested tags smoke |
| `tagged-basic.pdf` | Multi-heading layout |
| `table-heavy.pdf` | Table-ish layout for pane QA |
| `corrupt.pdf` | Failure UX |
| `golden/` | Expected outline / HTML snippets for unit tests |

Generate/regenerate from repo root (uses scanner `pdf-lib`):

```bash
cd apps/scanner
node --input-type=module -e "/* see repo history / agent script that wrote these */"
```

Or leave checked-in binaries as-is.
