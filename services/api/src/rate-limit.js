import { config } from "./config.js";
import { redis } from "./queue.js";

function getClientIp(req) {
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd.length) {
        return fwd.split(",")[0].trim();
    }
    return req.ip || "unknown";
}

export async function rateLimitPreHandler(req, reply) {
    const ip = getClientIp(req);
    const minute = Math.floor(Date.now() / 60000);
    const key = `rl:${ip}:${minute}`;

    const count = await redis.incr(key);
    if (count === 1) {
        await redis.expire(key, 70);
    }

    reply.header("X-RateLimit-Limit", String(config.requestPerMinute));
    reply.header("X-RateLimit-Remaining", String(Math.max(0, config.requestPerMinute - count)));

    if (count > config.requestPerMinute) {
        reply.code(429).send({ error: "rate limit exceeded" });
    }
}

