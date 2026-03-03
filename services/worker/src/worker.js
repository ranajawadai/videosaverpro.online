import { Worker } from "bullmq";
import IORedis from "ioredis";
import pg from "pg";
import { resolveJobMedia } from "./extractor.js";

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

    // Stage 2: resolve direct media URL via self-hosted extractor (yt-dlp)
    await new Promise((r) => setTimeout(r, 250));
    await markJob(id, { progress: 55, title: `Processing ${quality || "best"} ${format || "mp4"}` });
    const resolved = await resolveJobMedia(url, quality, format);
    const directMediaUrl = resolved?.mediaUrl || null;
    if (!directMediaUrl) throw new Error("No direct media URL resolved by self-hosted extractor.");
    await markJob(id, {
        title: resolved.title || "Download ready",
        thumbnail_url: resolved.thumbnail || "https://www.videosaverpro.online/og-image.png"
    });

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
