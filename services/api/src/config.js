export const config = {
    port: Number(process.env.PORT || 8080),
    redisUrl: process.env.REDIS_URL || "redis://localhost:6379",
    dbUrl: process.env.DATABASE_URL || "postgres://postgres:postgres@localhost:5432/videosaverpro",
    corsOrigin: process.env.CORS_ORIGIN || "http://localhost:8788",
    jobQueueName: process.env.JOB_QUEUE_NAME || "video_jobs",
    apiBaseUrl: process.env.API_BASE_URL || "http://localhost:8080",
    requestPerMinute: Number(process.env.REQUESTS_PER_MINUTE || 120),
    inspectCacheTtlSeconds: Number(process.env.INSPECT_CACHE_TTL_SECONDS || 300),
    requireApiKey: String(process.env.REQUIRE_API_KEY || "false") === "true",
    serviceApiKey: process.env.SERVICE_API_KEY || "",
    signedUrlTtlSeconds: Number(process.env.SIGNED_URL_TTL_SECONDS || 3600),
    ytDlpTimeoutMs: Number(process.env.YTDLP_TIMEOUT_MS || 30000)
};

export const supportedPlatforms = [
    "tiktok.com",
    "instagram.com",
    "facebook.com",
    "youtube.com",
    "youtu.be",
    "x.com",
    "twitter.com",
    "vimeo.com",
    "dailymotion.com",
    "reddit.com"
];
