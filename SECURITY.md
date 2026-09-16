# Security Policy

## Supported versions

Security fixes are applied on the default branch of this repository. If you run a fork or an older tag, please rebase or cherry-pick as needed.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security problems.

Use [GitHub Security Advisories](https://github.com/phatphillips/SiteNook/security/advisories/new) (private) for this repository, or email the maintainer listed on the GitHub profile if advisories are unavailable.

Include:

- Affected component (`apps/web`, `apps/scanner`, PocketBase hooks, etc.)
- Steps to reproduce
- Impact (auth bypass, data exposure, RCE, etc.)
- Any suggested fix

We will acknowledge receipt when we can and work on a fix before any public disclosure.

## Secrets

Never commit real API keys, Stripe secrets, licence signing secrets, or production passwords. Use `.env.example` as a template only. See `.gitignore` for ignored patterns (`credentials.json`, `*.pem`, `.env`).
