---
title: Search returns nothing
description: Global site search and Help search both depend on Typesense.
category: troubleshooting
order: 30
---

## Help search says unavailable

Help Center search needs Typesense with `TYPESENSE_ENABLED=1`. If the index is down, the hub shows **Search temporarily unavailable** while categories still work.

## Global search in the app is empty

Site crawl search indexes pages into a separate collection during scans. Run a full scan, then reindex search if your deployment provides a reindex script.

## After deploying new help articles

Run `npm run reindex-help` from `apps/web` (with the web app reachable) so the `help_articles` collection picks up new Markdown.
