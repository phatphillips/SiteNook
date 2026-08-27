---
title: Scan stuck in running
description: Recover when a crawl never finishes or progress stalls.
category: troubleshooting
order: 10
---

## Why do scans get stuck?

Common causes: the target site is down, auth loops, infinite calendars/filters, or the scanner worker restarted mid-job.

## What should I try first?

1. Open the scan log / live crawl output for repeating errors.
2. **Cancel** the stuck scan.
3. Fix config (exclude noisy paths, fix credentials).
4. Start a new scan with a lower **max pages** to validate.

## Still stuck?

Confirm the scanner container is healthy and can reach PocketBase and the target site. Check Docker logs for the scanner service.
