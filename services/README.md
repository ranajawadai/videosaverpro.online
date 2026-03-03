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
- Worker resolves direct media URL via RapidAPI (`RAPIDAPI_KEY`) and stores signed remote redirect keys.
- Signed `/v1/files/stream` now redirects for `remote:` keys.
- For private object storage (R2/S3), extend stream handler for non-remote keys.
