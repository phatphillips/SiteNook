---
title: Cancel a scan
description: Stop a running or queued crawl when you need to change config.
category: scanning
order: 10
---

## How do I cancel a scan?

1. Open the site’s **Scans** list (or the live progress view).
2. Find the queued or running scan.
3. Click **Cancel**.

The scanner marks the queue item and scan as **cancelled**. Partial results already written may remain for that run.

## When should I cancel?

- You started a scan with the wrong include/exclude patterns.
- Auth credentials were wrong and every page is failing.
- You need to free concurrency for a higher-priority site.
