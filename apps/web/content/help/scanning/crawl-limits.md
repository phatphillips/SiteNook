---
title: Crawl limits and URL filters
description: Control how deep and wide a scan goes with max pages and patterns.
category: scanning
order: 30
---

## How do include and exclude patterns work?

Patterns match path segments (for example `/blog/*` or `/admin/*`). Included URLs are preferred when set; excluded URLs are skipped even if linked from other pages.

## What is max pages?

**Max pages** caps how many HTML pages one scan will crawl. Raise it for large sites; lower it for smoke checks after a deploy.

## Authentication

If the site needs login, configure credentials in the scan settings so Playwright can authenticate before crawling private sections.
