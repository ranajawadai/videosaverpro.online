import Fastify from "fastify";
import { nanoid } from "nanoid";
import { Readable } from "stream";
import { config } from "./config.js";
import { initDb, pool } from "./db.js";
import { jobsQueue, redis } from "./queue.js";
import { detectPlatform, normalizeUrl } from "./platform.js";
import { authPreHandler } from "./auth.js";
import { rateLimitPreHandler } from "./rate-limit.js";
import { createSignedFileUrl, validateSignedFileUrl } from "./storage.js";
import { inspectWithYtDlp } from "./extractor.js";

const app = Fastify({ logger: true });

function resolveAllowedOrigin(origin) {
    const raw = process.env.CORS_ORIGINS || config.corsOrigin || "https://www.videosaverpro.online,https://videosaverpro.online";
    const allowlist = raw.split(",").map((v) => v.trim()).filter(Boolean);
    if (origin && allowlist.includes(origin)) return origin;
    return allowlist[0] || "https://www.videosaverpro.online";
}

app.addHook("onRequest", async (req, reply) => {
    const allowedOrigin = resolveAllowedOrigin(req.headers.origin);
    reply.header("Access-Control-Allow-Origin", allowedOrigin);
    reply.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    reply.header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Api-Key,Idempotency-Key");
    if (req.method === "OPTIONS") return reply.code(204).send();
});

app.addHook("preHandler", authPreHandler);
app.addHook("preHandler", rateLimitPreHandler);

app.addHook("onResponse", async (req, reply) => {
    try {
        const latency = Date.now() - req.startTime;
        await pool.query(
            "insert into usage_events(route, method, actor_ip, status_code, latency_ms) values ($1,$2,$3,$4,$5)",
            [req.routerPath || req.url, req.method, req.ip || null, reply.statusCode, latency]
        );
    } catch {
        // no-op
    }
});

app.addHook("onRequest", async (req) => {
    req.startTime = Date.now();
});

app.get("/v1/health", async () => ({ status: "ok" }));

app.post("/v1/link/inspect", async (req, reply) => {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") return reply.code(400).send({ error: "url is required" });

    let normalized;
    try {
        normalized = normalizeUrl(url);
    } catch {
        return reply.code(400).send({ error: "invalid url" });
    }

    const platform = detectPlatform(normalized);
    if (!platform) return reply.code(400).send({ error: "unsupported platform" });

    const cacheKey = `inspect:${normalized}`;
    const cached = await redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    let preview;
    try {
        preview = await inspectWithYtDlp(normalized, platform);
    } catch (err) {
        req.log.error({ err }, "inspect failed");
        return reply.code(502).send({ error: "failed to inspect url" });
    }
    await redis.set(cacheKey, JSON.stringify(preview), "EX", config.inspectCacheTtlSeconds);
    return preview;
});

app.post("/v1/jobs", async (req, reply) => {
    const { url, quality = "1080p", format = "mp4" } = req.body || {};
    if (!url || typeof url !== "string") return reply.code(400).send({ error: "url is required" });

    let normalized;
    try {
        normalized = normalizeUrl(url);
    } catch {
        return reply.code(400).send({ error: "invalid url" });
    }

    const platform = detectPlatform(normalized);
    if (!platform) return reply.code(400).send({ error: "unsupported platform" });

    const idem = req.headers["idempotency-key"];
    if (typeof idem === "string" && idem.length > 8) {
        const cachedJob = await redis.get(`idem:${idem}`);
        if (cachedJob) return reply.code(202).send(JSON.parse(cachedJob));
    }

    const id = nanoid();
    await pool.query(
        "insert into jobs (id, url, platform, status, progress, quality, format) values ($1,$2,$3,'queued',0,$4,$5)",
        [id, normalized, platform, quality, format]
    );

    await jobsQueue.add(
        "download",
        { id, url: normalized, platform, quality, format },
        { attempts: 3, backoff: { type: "exponential", delay: 1000 }, removeOnComplete: 5000, removeOnFail: 2000 }
    );

    const payload = { job_id: id, status: "queued" };
    if (typeof idem === "string" && idem.length > 8) {
        await redis.set(`idem:${idem}`, JSON.stringify(payload), "EX", 600);
    }
    return reply.code(202).send(payload);
});

app.get("/v1/jobs/:job_id", async (req, reply) => {
    const { job_id } = req.params;
    const { rows } = await pool.query("select * from jobs where id=$1", [job_id]);
    if (!rows.length) return reply.code(404).send({ error: "job not found" });
    const j = rows[0];
    return {
        job_id: j.id,
        status: j.status,
        progress: j.progress,
        platform: j.platform,
        title: j.title,
        thumbnail_url: j.thumbnail_url,
        error: j.error
    };
});

app.get("/v1/jobs/:job_id/files", async (req, reply) => {
    const { job_id } = req.params;
    const { rows } = await pool.query("select status from jobs where id=$1", [job_id]);
    if (!rows.length) return reply.code(404).send({ error: "job not found" });
    if (rows[0].status !== "completed") return reply.code(400).send({ error: "job is not completed yet" });

    const filesRes = await pool.query(
        "select label, storage_key, mime_type, size_bytes from job_files where job_id=$1 order by id asc",
        [job_id]
    );

    return {
        job_id,
        expires_at: new Date(Date.now() + config.signedUrlTtlSeconds * 1000).toISOString(),
        files: filesRes.rows.map((f) => ({
            label: f.label,
            mime_type: f.mime_type,
            size_bytes: f.size_bytes,
            url: createSignedFileUrl(f.storage_key)
        }))
    };
});

app.post("/v1/jobs/:job_id/cancel", async (req, reply) => {
    const { job_id } = req.params;
    const result = await pool.query(
        "update jobs set status='cancelled', updated_at=now() where id=$1 and status in ('queued','processing')",
        [job_id]
    );
    if (!result.rowCount) return reply.code(404).send({ error: "job not found or not cancellable" });
    return { job_id, status: "cancelled" };
});

app.get("/v1/files/stream", async (req, reply) => {
    const { key, exp, sig } = req.query || {};
    const valid = validateSignedFileUrl(key, exp, sig);
    if (!valid) return reply.code(403).send({ error: "invalid signature" });

    // Remote key format: remote:<base64url(media_url)>
    if (typeof key === "string" && key.startsWith("remote:")) {
        const encoded = key.slice("remote:".length);
        let target = "";
        try {
            target = Buffer.from(encoded, "base64url").toString("utf8");
        } catch {
            return reply.code(400).send({ error: "invalid remote key" });
        }
        if (!/^https?:\/\//i.test(target)) {
            return reply.code(400).send({ error: "invalid redirect target" });
        }
        const upstream = await fetch(target, { method: "GET", redirect: "follow" });
        if (!upstream.ok || !upstream.body) {
            return reply.code(502).send({ error: "failed to fetch upstream media" });
        }

        const filename = "videosaverpro-download.mp4";
        reply.header("Content-Type", upstream.headers.get("content-type") || "video/mp4");
        reply.header("Content-Disposition", `attachment; filename="${filename}"`);
        reply.header("Cache-Control", "no-store");
        reply.header("Access-Control-Allow-Origin", resolveAllowedOrigin(req.headers.origin));

        return reply.send(Readable.fromWeb(upstream.body));
    }

    // TODO: implement real object-store streaming for non-remote keys
    return reply.code(501).send({
        error: "stream backend not configured for this key type",
        key
    });
});

async function start() {
    await initDb();
    await app.listen({ port: config.port, host: "0.0.0.0" });
}

start().catch((err) => {
    app.log.error(err);
    process.exit(1);
});
