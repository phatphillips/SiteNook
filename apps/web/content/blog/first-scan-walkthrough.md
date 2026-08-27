---
title: Your first SiteNook scan in five minutes
description: Add a site, queue a crawl, and review accessibility and QA findings without becoming an a11y engineer.
date: 2026-06-15
category: guides
authors:
  - Jordan Blake
image: /blog/first-scan.svg
featured: true
---

You do not need a specialist background to start. This walkthrough gets you from empty workspace to a finished scan.

## 1. Add your site

From **Sites**, enter the homepage URL. SiteNook will use that as the crawl seed. You can refine include/exclude patterns later.

## 2. Queue a full scan

Click **Scan** and keep the defaults for your first run. The scanner crawls pages with Playwright, runs axe-core for WCAG issues, and checks broken links and spelling.

![Live crawl activity in the scan monitor](/blog/first-scan.svg)

## 3. Watch progress

Open **Scans** to see pages crawled, elapsed time, and live crawl activity. You can stop a run if you need to adjust config.

## 4. Review findings

When the scan completes:

- **Accessibility** — score, trends, and open issues
- **QA** — broken links and misspellings
- **SEO** (Team+) — technical and content checks

Start with critical/serious accessibility issues and anything blocking key journeys (forms, navigation, checkout).

## 5. Invite teammates

From **Settings → Team**, invite content owners and developers as viewers or admins so fixes do not live in one person's inbox.

That is it. Re-scan after fixes land to confirm scores and issue counts move the right way.
