# VideoSaverPro API Architecture (High Scale Blueprint)

## 1. Goal
- Build a production-grade API for public video link inspection and asynchronous download jobs.
- Support burst traffic and scale to 1000+ concurrent requests safely.
- Integrate with existing Cloudflare Pages frontend.

## 2. Core Principles
- API must be non-blocking: create jobs quickly, process in background.
- Downloader logic should be isolated from request lifecycle.
- Every external dependency must have timeout, retry, and circuit-breaker behavior.
- Strong observability first: logs, traces, metrics, alerts.

## 3. Logical Components
1. Frontend (Cloudflare Pages)
- Sends URL to `inspect` endpoint.
- Shows title, thumbnail, duration, and quality choices.
- Creates download jobs and polls status.

2. API Gateway (Cloudflare Worker)
- Request validation, bot checks, coarse rate limiting, caching.
- Routes traffic to backend API service.
- Hides origin and adds edge protections.

3. API Service (Fastify)
- Endpoints:
  - inspect link metadata
  - create job
  - read job status
  - fetch signed file links
  - cancel job
- Writes jobs and usage events to Postgres.
- Pushes work to Redis queue (BullMQ).

4. Worker Service
- Consumes queue jobs.
- Uses platform adapters to fetch media metadata/streams.
- Uploads temporary outputs to R2-compatible storage.
- Updates job state/progress in Postgres.

5. Data Layer
- Redis: queue + fast counters + distributed rate limits.
- Postgres: durable state, users, quotas, jobs, billing usage.
- R2/S3: output files and thumbnails cache.

6. Monitoring
- Prometheus metrics from API + worker.
- Error tracking (Sentry).
- Logs with request_id/job_id correlation.

## 4. Request Flow
1. User submits URL.
2. `POST /v1/link/inspect` validates URL and platform support.
3. API returns preview payload (title, thumbnail, duration, formats).
4. User selects options and calls `POST /v1/jobs`.
5. API stores job row and queues job in Redis.
6. Worker picks job, processes media, uploads file(s), updates progress.
7. User polls `GET /v1/jobs/:id`.
8. On completion, `GET /v1/jobs/:id/files` returns signed URLs.

## 5. Scaling Model
- API service scale trigger:
  - CPU > 65% or p95 latency > target.
- Worker scale trigger:
  - queue depth and active jobs.
- Separate concurrency controls:
  - global max workers
  - per-platform concurrent limits
  - per-user quotas

## 6. Reliability Controls
- Idempotency key support on job creation.
- Retry policy:
  - transient errors: exponential backoff with jitter
  - permanent errors: fail fast
- Dead-letter queue for repeated failures.
- Storage/file TTL cleanup cron.

## 7. Security
- API keys for server-to-server clients.
- Optional JWT for dashboard users.
- SSRF-safe URL checks (protocol/domain/ip rules).
- Strict CORS to site origin.
- WAF + anti-bot at Cloudflare layer.

## 8. Compliance-Safe Product Guardrails
- Public links only.
- Respect takedown workflows.
- No credential collection from users.
- Explicit terms and misuse policy.

## 9. Recommended SLO Targets
- `POST /v1/link/inspect` p95 <= 2.5s
- `POST /v1/jobs` p95 <= 300ms
- API availability >= 99.9%
- Worker queue wait p95 <= 30s under normal load

## 10. Folder Layout
```text
services/
  api/
  worker/
infra/
  env.example
OPENAPI.yaml
docker-compose.dev.yml
```

