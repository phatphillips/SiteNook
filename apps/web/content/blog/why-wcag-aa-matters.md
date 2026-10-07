---
title: Why WCAG AA still matters for public websites
description: A short research note on legal risk, trust, and the practical case for aiming at Level AA on public-facing sites.
date: 2026-05-22
category: research
authors:
  - Dr. Priya Nair
image: /blog/wcag-aa.svg
featured: false
---

Public websites are often the first. And sometimes only. Channel people use to access services. When those sites fail basic accessibility checks, the cost shows up as abandoned tasks, support tickets, and, increasingly, formal complaints.

## What Level AA covers

WCAG 2.x Level **AA** is the bar most public-sector and large commercial policies reference. It builds on Level A with requirements that strongly affect real use:

- Color contrast for text and UI
- Resize and reflow without loss of content
- Consistent navigation and labeling
- Error identification in forms

AAA remains valuable for specialized audiences, but AA is the realistic target for most site-wide programs.

![Illustrative AA conformance card](/blog/wcag-aa.svg)

## Automated checks are necessary, not sufficient

Tools like axe-core catch many high-impact failures quickly. Missing names, contrast candidates, landmark issues. They do not replace human review of media alternatives, complex interactions, or content clarity.

The strongest programs combine:

1. Scheduled automated crawls
2. Prioritized remediation by impact and points to gain
3. Periodic manual review of key journeys

## What to measure

Track overall score **and** open-issue counts. A rising score with flat critical issues can mean easy wins were taken while blockers remain. Trends over 30–90 days are more honest than a single audit PDF.

SiteNook is built around that loop: crawl, score, prioritize, re-scan.
