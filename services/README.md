# Services Bootstrap

This folder contains the backend skeleton for:
- `api`: Fastify API for inspect/jobs/status/files/cancel
- `worker`: BullMQ worker for asynchronous processing
- `gateway`: Cloudflare Worker edge gateway in `/gateway`

## Local Run
1. Copy `infra/env.example` values into your runtime environment.
2. Run:
   - `docker compose -f docker-compose.dev.yml up --build`
3. API health:
   - `GET http://localhost:8080/v1/health`
4. Create inspect request:
   - `POST http://localhost:8080/v1/link/inspect` with `{"url":"https://www.tiktok.com/@user/video/123"}`
5. Create job:
   - `POST http://localhost:8080/v1/jobs` with `{"url":"https://www.tiktok.com/@user/video/123"}`

## Notes
- Worker currently includes placeholder download stages and writes `job_files` records.
- Signed URL flow is scaffolded and should be connected to real R2/S3 object fetch/redirect.
