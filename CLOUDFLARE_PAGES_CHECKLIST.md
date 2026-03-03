# Cloudflare Pages + GitHub Monorepo Checklist

This repo contains:
- Static website (Cloudflare Pages deploy target)
- Backend API/worker code (`services/`, `infra/`, `gateway/`) for Railway/Render + Cloudflare Worker gateway

## A) Cloudflare Pages (website) settings
1. Go to Cloudflare Dashboard -> Pages -> `videosaverpro.online`.
2. `Settings` -> `Builds & deployments`:
   - Framework preset: `None`
   - Build command: leave empty
   - Build output directory: `/`
   - Root directory: `/` (repo root)
3. Confirm Pages should deploy static files only.
4. Ensure `_headers`, `_routes.json`, `robots.txt`, `sitemap.xml` are present in deploy output.

## B) Why monorepo is safe here
- `_routes.json` currently includes only `/api/*` for Pages Functions.
- Backend folders are outside `functions/`, so Pages will not execute them as Functions.
- Cloudflare Pages only serves/deploys your site files; API runtime lives separately.

## C) API deployment (separate from Pages)
1. Deploy `services/api` to Railway/Render.
2. Deploy `services/worker` to Railway/Render.
3. Provision Redis + Postgres and attach env vars from `infra/env.example`.

## D) Cloudflare Worker gateway
1. Use `gateway/cloudflare-worker.js` + `gateway/wrangler.toml`.
2. Set Worker vars:
   - `API_ORIGIN` = your Railway/Render API URL
   - `CORS_ORIGIN` = `https://www.videosaverpro.online`
   - `CORS_ORIGINS` = `https://www.videosaverpro.online,https://videosaverpro.online`
   - `GATEWAY_RPM` = desired edge rate limit
3. Bind KV namespace as `RATE_LIMIT_KV`.
4. Route `api.videosaverpro.online/*` to this Worker.

## E) Frontend API switch
1. In [index.html](./index.html), set:
   - `window.VSP_API_BASE = "https://api.videosaverpro.online";`
2. Redeploy Pages.

## F) Verify after deploy
1. Open website and test one video URL.
2. Browser network:
   - Inspect call should hit `/v1/link/inspect`
   - Job create/status/files calls should succeed
3. Check CSP:
   - `_headers` includes `https://api.videosaverpro.online` in `connect-src`.

## G) Secrets policy
- Never commit secrets in GitHub.
- Keep API keys in Cloudflare/Railway/Render environment variables only.
