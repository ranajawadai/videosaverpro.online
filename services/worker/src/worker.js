import { Worker } from "bullmq";
import IORedis from "ioredis";
import pg from "pg";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const jobQueueName = process.env.JOB_QUEUE_NAME || "video_jobs";
const dbUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/videosaverpro";
const workerConcurrency = Number(process.env.WORKER_CONCURRENCY || 20);

const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

const { Pool } = pg;
const pool = new Pool({ connectionString: dbUrl });

async function markJob(id, patch) {
    const fields = [];
    const values = [];
    let idx = 1;
    for (const [k, v] of Object.entries(patch)) {
        fields.push(`${k}=$${idx++}`);
        values.push(v);
    }
    values.push(id);
    const sql = `update jobs set ${fields.join(", ")}, updated_at=now() where id=$${idx}`;
    await pool.query(sql, values);
}

async function addJobFile(jobId, label, storageKey, sizeBytes = null) {
    await pool.query(
        "insert into job_files (job_id, label, storage_key, mime_type, size_bytes) values ($1,$2,$3,'video/mp4',$4)",
        [jobId, label, storageKey, sizeBytes]
    );
}

async function processDownloadJob(data) {
    const { id, url, platform, quality, format } = data;
    await markJob(id, { status: "processing", progress: 10, title: `Preparing ${platform} media` });

    // Stage 1: metadata resolution
    await new Promise((r) => setTimeout(r, 250));
    await markJob(id, { progress: 30, thumbnail_url: "https://www.videosaverpro.online/og-image.png" });

    // Stage 2: resolve direct media URL via RapidAPI (if configured)
    await new Promise((r) => setTimeout(r, 250));
    await markJob(id, { progress: 55, title: `Processing ${quality || "best"} ${format || "mp4"}` });

    const rapidApiKey = process.env.RAPIDAPI_KEY || "";
    let directMediaUrl = null;

    if (rapidApiKey) {
        const upstream = await fetch("https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-RapidAPI-Key": rapidApiKey,
                "X-RapidAPI-Host": "social-download-all-in-one.p.rapidapi.com"
            },
            body: JSON.stringify({ url })
        });

        if (upstream.ok) {
            const payload = await upstream.json();
            const media = payload?.medias?.find((m) => !m.watermark && m.extension === "mp4") || payload?.medias?.[0];
            if (media?.url) {
                directMediaUrl = media.url;
                await markJob(id, {
                    title: payload?.title || "Download ready",
                    thumbnail_url: payload?.thumbnail || "https://www.videosaverpro.online/og-image.png"
                });
            }
        }
    }

    if (!directMediaUrl) {
        throw new Error("No direct media URL resolved. Set RAPIDAPI_KEY and retry.");
    }

    // Stage 3: store remote target key for signed redirect
    const storageKey = `remote:${Buffer.from(directMediaUrl, "utf8").toString("base64url")}`;
    await new Promise((r) => setTimeout(r, 200));
    await addJobFile(id, "Primary Download", storageKey, null);

    await markJob(id, {
        status: "completed",
        progress: 100,
        title: "Download ready"
    });
}

const worker = new Worker(
    jobQueueName,
    async (job) => {
        await processDownloadJob(job.data);
    },
    { connection, concurrency: workerConcurrency }
);

worker.on("completed", (job) => {
    console.log(`[worker] completed job=${job.id}`);
});

worker.on("failed", async (job, err) => {
    console.error(`[worker] failed job=${job?.id}`, err?.message);
    if (job?.data?.id) {
        await markJob(job.data.id, {
            status: "failed",
            error: err?.message || "worker failure"
        });
    }
});

console.log(`[worker] started queue=${jobQueueName} concurrency=${workerConcurrency}`);
