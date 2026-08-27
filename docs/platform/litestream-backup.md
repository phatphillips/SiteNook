# Litestream backup for PocketBase SQLite

Continuous replication of the PocketBase SQLite database to S3-compatible storage (Backblaze B2, AWS S3, MinIO, etc.).

## Enable in Docker Compose

```bash
# .env
LITESTREAM_S3_BUCKET=your-bucket
LITESTREAM_S3_ENDPOINT=https://s3.us-east-005.backblazeb2.com
LITESTREAM_ACCESS_KEY_ID=your-key-id
LITESTREAM_SECRET_ACCESS_KEY=your-secret
LITESTREAM_S3_REGION=us-east-005

docker compose --profile backup up -d
```

The `litestream` service shares the `pb_data` volume with PocketBase and runs alongside the stack.

## Restore (disaster recovery)

1. Stop PocketBase and scanner.
2. Use [Litestream restore](https://litestream.io/reference/restore/) against `pb_data/data.db`.
3. Restart the stack.

## Notes

- Litestream is **backup/DR**, not a scaling layer — PocketBase remains single-writer SQLite.
- Use a dedicated bucket path per environment (`sitenook/pocketbase` in the default config).
- For local dev, omit the `backup` profile — no Litestream container is started.
