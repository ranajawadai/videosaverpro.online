export default {
    async fetch(request, env) {
        const origin = request.headers.get("Origin") || "";
        const allowedOrigin = resolveAllowedOrigin(origin, env);

        if (request.method === "OPTIONS") {
            return new Response(null, {
                status: 204,
                headers: {
                    "Access-Control-Allow-Origin": allowedOrigin,
                    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type,Authorization,X-Api-Key,Idempotency-Key",
                    "Access-Control-Max-Age": "86400",
                    "Vary": "Origin"
                }
            });
        }

        const url = new URL(request.url);
        const ip = request.headers.get("CF-Connecting-IP") || "unknown";
        const minuteBucket = Math.floor(Date.now() / 60000);
        const rateKey = `${ip}:${minuteBucket}`;
        const limit = Number(env.GATEWAY_RPM || 240);

        if (env.RATE_LIMIT_KV) {
            const current = Number(await env.RATE_LIMIT_KV.get(rateKey) || 0) + 1;
            await env.RATE_LIMIT_KV.put(rateKey, String(current), { expirationTtl: 70 });
            if (current > limit) {
                return json({ error: "gateway rate limit exceeded" }, 429, allowedOrigin);
            }
        }

        if (!url.pathname.startsWith("/v1/")) {
            return json({ error: "not found" }, 404, allowedOrigin);
        }

        const backend = env.API_ORIGIN;
        if (!backend) {
            return json({ error: "API_ORIGIN missing" }, 500, allowedOrigin);
        }

        const target = new URL(url.pathname + url.search, backend);
        const outbound = new Request(target.toString(), request);
        outbound.headers.set("x-forwarded-for", ip);

        const response = await fetch(outbound);
        const headers = new Headers(response.headers);
        headers.set("Access-Control-Allow-Origin", allowedOrigin);
        headers.set("Vary", "Origin");
        return new Response(response.body, { status: response.status, headers });
    }
};

function json(data, status, origin) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": origin,
            "Vary": "Origin"
        }
    });
}

function resolveAllowedOrigin(requestOrigin, env) {
    const defaultOrigins = [
        "https://www.videosaverpro.online",
        "https://videosaverpro.online"
    ];

    const allowlist = new Set(defaultOrigins);
    for (const raw of [env.CORS_ORIGINS, env.CORS_ORIGIN]) {
        if (!raw) continue;
        for (const item of String(raw).split(",")) {
            const normalized = normalizeOrigin(item);
            if (normalized) allowlist.add(normalized);
        }
    }

    const normalizedRequestOrigin = normalizeOrigin(requestOrigin);
    if (normalizedRequestOrigin && allowlist.has(normalizedRequestOrigin)) {
        return requestOrigin;
    }
    if (normalizedRequestOrigin && /^https:\/\/(www\.)?videosaverpro\.online$/i.test(normalizedRequestOrigin)) {
        return requestOrigin;
    }

    return defaultOrigins[0];
}

function normalizeOrigin(value) {
    return String(value || "").trim().replace(/\/+$/, "").toLowerCase();
}
