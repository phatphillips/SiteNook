# SiteNook MCP (optional)

Connect Cursor (or another MCP client) to your SiteNook instance so an agent can list sites, read accessibility/QA issues, enqueue scans, and search content.

This is **optional**. The dashboard works without MCP.

## Prerequisites

1. SiteNook running locally (Docker Compose or `apps/web` + PocketBase).
2. PocketBase has applied migration `1730000072_org_api_keys`:
   - Rebuild/restart PocketBase after pull:  
     `docker compose build pocketbase` then `docker compose up -d pocketbase`  
     (or `docker cp` the migration into the container and restart, as during first setup).
3. You are an **org admin**.
4. Nuxt web is healthy (`http://localhost:3500` with this repo’s Docker override). If the dashboard itself won’t load, fix Docker/OneDrive sync first — MCP depends on `/api/agent/*`.

## 1. Create an API key

1. Open the dashboard → **Settings → Integrations**.
2. In **MCP / API keys**, name a key (e.g. `Cursor MCP`), leave write enabled if you want scan/QA actions, click **Create key**.
3. **Copy the key immediately** — it is shown once.

## 2. Install the MCP package

From the repo root:

```bash
cd apps/mcp
npm install
npm run build
```

## 3. Add to Cursor

Cursor → **Settings → MCP → Add new MCP server** (or edit your MCP JSON).

**Dev (tsx, no build required after `npm install`):**

```json
{
  "mcpServers": {
    "sitenook": {
      "command": "npx",
      "args": ["tsx", "C:/Users/YOU/path/to/accessibility-checker/apps/mcp/src/index.ts"],
      "env": {
        "SITENOOK_URL": "http://localhost:3000",
        "SITENOOK_API_KEY": "ak_PASTE_YOUR_KEY"
      }
    }
  }
}
```

**Or after `npm run build`:**

```json
{
  "mcpServers": {
    "sitenook": {
      "command": "node",
      "args": ["C:/Users/YOU/path/to/accessibility-checker/apps/mcp/dist/index.js"],
      "env": {
        "SITENOOK_URL": "http://localhost:3000",
        "SITENOOK_API_KEY": "ak_PASTE_YOUR_KEY"
      }
    }
  }
}
```

Use your real Nuxt URL:

- This repo’s Docker override maps Nuxt to **`http://localhost:3500`**
- Hot reload without that mapping: often `http://localhost:3000`
- Behind nginx on port 80: `http://localhost`

Restart the MCP server in Cursor after saving.

## 4. Try it

In a Cursor chat:

- “List my SiteNook sites”
- “Show open accessibility issues for site &lt;id&gt;”
- “Enqueue a full scan for site &lt;id&gt;”

You should see SiteNook tool calls (`list_sites`, `list_accessibility_issues`, etc.).

## Tools

| Tool | Needs write scope |
|------|-------------------|
| `list_sites` | No |
| `get_site` | No |
| `get_scan_status` | No |
| `list_accessibility_issues` | No |
| `list_qa_issues` | No |
| `search_content` | No (Typesense must be enabled) |
| `enqueue_scan` | Yes |
| `cancel_scan` | Yes |
| `update_qa_status` | Yes |

## Agent HTTP API (same backend)

MCP is a thin wrapper over:

- `GET /api/agent/sites`
- `GET /api/agent/sites/:siteId`
- `POST /api/agent/sites/:siteId/scans`
- `GET /api/agent/sites/:siteId/scans`
- `POST /api/agent/scans/:id/cancel`
- `GET /api/agent/sites/:siteId/accessibility/issues`
- `GET /api/agent/sites/:siteId/qa/issues`
- `POST /api/agent/sites/:siteId/qa/bulk-status`
- `GET /api/agent/search?q=`
- Key management (user JWT, admin only): `GET/POST /api/agent/keys`, `DELETE /api/agent/keys/:id`

Auth: `Authorization: Bearer ak_…` or a normal PocketBase user JWT.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| MCP fails on start: missing env | Set `SITENOOK_URL` and `SITENOOK_API_KEY` |
| `401 Invalid API key` | Recreate key; ensure PocketBase migration ran |
| `503` admin credentials | Web server needs `NUXT_PB_ADMIN_EMAIL` / `NUXT_PB_ADMIN_PASSWORD` (same as Docker) |
| `403 Write access required` | Create a key with write enabled |
| Search `503` | Typesense disabled — other tools still work |

## Security notes

- Treat API keys like passwords; revoke from Integrations if leaked.
- Prefer read-only keys when you only need issue triage.
- Do not commit keys to git.
