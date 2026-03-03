# Deployment Runbook (Cloudflare + Railway/Render)

## 1. Backend API Service
Deploy folder: `services/api`

Required env:
- `PORT`
- `DATABASE_URL`
- `REDIS_URL`
- `API_BASE_URL`
- `CORS_ORIGIN`
- `JOB_QUEUE_NAME`
- `REQUESTS_PER_MINUTE`
- `SIGNED_URL_TTL_SECONDS`
- `SIGNED_URL_SECRET`
- `YTDLP_TIMEOUT_MS` (optional, default 30000)
- `REQUIRE_API_KEY`
- `SERVICE_API_KEY` (if required)

## 2. Worker Service
Deploy folder: `services/worker`

Required env:
- `DATABASE_URL`
- `REDIS_URL`
- `JOB_QUEUE_NAME`
- `WORKER_CONCURRENCY`
- `YTDLP_TIMEOUT_MS` (optional, default 45000)

## 3. Cloudflare Worker Gateway
Files:
- `gateway/cloudflare-worker.js`
- `gateway/wrangler.toml`

Set vars:
- `API_ORIGIN` -> backend API base
- `CORS_ORIGIN` -> frontend domain
- `GATEWAY_RPM` -> edge request limit

Add KV binding:
- `RATE_LIMIT_KV`

## 4. Frontend Integration
In frontend page, set:
```html
<script>
  window.VSP_API_BASE = "https://api.videosaverpro.online";
</script>
```

## 5. Smoke Test Checklist
1. `GET /v1/health` returns `ok`
2. `POST /v1/link/inspect` returns metadata
3. `POST /v1/jobs` returns queued `job_id`
4. `GET /v1/jobs/:id` reaches `completed`
5. `GET /v1/jobs/:id/files` returns signed link objects

## 6. Production Hardening (Next)
- Replace placeholder worker processing with real platform adapters
- Connect signed URL endpoint to R2/S3
- Add JWT user auth + plan quotas
- Add billing webhooks
- Add dashboards and alerts
