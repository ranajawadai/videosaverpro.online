// VideoSaver Pro - Download API with Rate Limiting & Security
// Cloudflare Pages Function

// Allowed video domains - whitelist for security
const ALLOWED_DOMAINS = [
    'tiktok.com', 'www.tiktok.com', 'vm.tiktok.com', 'm.tiktok.com',
    'instagram.com', 'www.instagram.com',
    'youtube.com', 'www.youtube.com', 'youtu.be', 'm.youtube.com',
    'facebook.com', 'www.facebook.com', 'fb.watch', 'm.facebook.com',
    'twitter.com', 'www.twitter.com', 'x.com', 'www.x.com',
    'snapchat.com', 'www.snapchat.com',
    'reddit.com', 'www.reddit.com', 'v.redd.it',
    'vimeo.com', 'www.vimeo.com', 'player.vimeo.com',
    'pinterest.com', 'www.pinterest.com', 'pin.it',
    'twitch.tv', 'www.twitch.tv', 'clips.twitch.tv',
    'dailymotion.com', 'www.dailymotion.com'
];

// Rate limiting: 10 requests per minute per IP
const RATE_LIMIT = 10;
const RATE_WINDOW = 60; // seconds

/**
 * Check if URL domain is in whitelist
 */
function isAllowedDomain(urlString) {
    try {
        const url = new URL(urlString);
        const hostname = url.hostname.toLowerCase();
        return ALLOWED_DOMAINS.some(domain =>
            hostname === domain || hostname.endsWith('.' + domain)
        );
    } catch {
        return false;
    }
}

/**
 * Get client IP from request
 */
function getClientIP(request) {
    return request.headers.get('CF-Connecting-IP') ||
        request.headers.get('X-Forwarded-For')?.split(',')[0]?.trim() ||
        'unknown';
}

/**
 * Check rate limit using Cloudflare KV (or in-memory fallback)
 */
async function checkRateLimit(ip, env) {
    // If KV namespace is available, use it for distributed rate limiting
    if (env.RATE_LIMIT_KV) {
        const key = `rate:${ip}`;
        const now = Math.floor(Date.now() / 1000);
        const data = await env.RATE_LIMIT_KV.get(key, 'json');

        if (data && now - data.timestamp < RATE_WINDOW) {
            if (data.count >= RATE_LIMIT) {
                return { allowed: false, remaining: 0 };
            }
            await env.RATE_LIMIT_KV.put(key, JSON.stringify({
                count: data.count + 1,
                timestamp: data.timestamp
            }), { expirationTtl: RATE_WINDOW });
            return { allowed: true, remaining: RATE_LIMIT - data.count - 1 };
        } else {
            await env.RATE_LIMIT_KV.put(key, JSON.stringify({
                count: 1,
                timestamp: now
            }), { expirationTtl: RATE_WINDOW });
            return { allowed: true, remaining: RATE_LIMIT - 1 };
        }
    }

    // Fallback: allow all if KV not configured (log warning)
    // Fallback: allow all if KV not configured (log warning only in dev)
    // Note: In production without KV, this means no rate limiting is active.
    if (env.ENVIRONMENT === 'development') {
        console.warn('RATE_LIMIT_KV not configured - rate limiting disabled');
    }
    return { allowed: true, remaining: RATE_LIMIT };
}

/**
 * Create JSON response with CORS headers
 */
function jsonResponse(data, status = 200, rateHeaders = {}) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': 'https://www.videosaverpro.online',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            ...rateHeaders
        }
    });
}

/**
 * Handle OPTIONS preflight request
 */
export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            'Access-Control-Allow-Origin': 'https://www.videosaverpro.online',
            'Access-Control-Allow-Methods': 'POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Max-Age': '86400'
        }
    });
}

/**
 * Main POST handler
 */
export async function onRequestPost(context) {
    const { request, env } = context;
    const clientIP = getClientIP(request);

    try {
        // 1. Check rate limit
        const rateCheck = await checkRateLimit(clientIP, env);
        const rateHeaders = {
            'X-RateLimit-Limit': RATE_LIMIT.toString(),
            'X-RateLimit-Remaining': rateCheck.remaining.toString()
        };

        if (!rateCheck.allowed) {
            return jsonResponse(
                { error: 'Too many requests. Please wait a moment and try again.' },
                429,
                rateHeaders
            );
        }

        // 2. Parse request body
        let body;
        try {
            body = await request.json();
        } catch {
            return jsonResponse({ error: 'Invalid request format' }, 400, rateHeaders);
        }

        const { url } = body;

        // 3. Validate URL exists
        if (!url || typeof url !== 'string') {
            return jsonResponse({ error: 'Video URL is required' }, 400, rateHeaders);
        }

        // 4. Validate URL format
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        } catch {
            return jsonResponse({ error: 'Invalid URL format' }, 400, rateHeaders);
        }

        // 5. Validate domain whitelist
        if (!isAllowedDomain(url)) {
            return jsonResponse(
                { error: 'This website is not supported. Try TikTok, Instagram, YouTube, Facebook, or Twitter.' },
                400,
                rateHeaders
            );
        }

        // 6. Check API key
        const API_KEY = env.RAPIDAPI_KEY;
        if (!API_KEY) {
            console.error('RAPIDAPI_KEY not configured');
            return jsonResponse({ error: 'Service temporarily unavailable' }, 503, rateHeaders);
        }

        // 7. Call RapidAPI
        const response = await fetch(
            'https://social-download-all-in-one.p.rapidapi.com/v1/social/autolink',
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-RapidAPI-Key': API_KEY,
                    'X-RapidAPI-Host': 'social-download-all-in-one.p.rapidapi.com'
                },
                body: JSON.stringify({ url })
            }
        );

        if (!response.ok) {
            console.error('Upstream API error:', response.status);
            return jsonResponse(
                { error: 'Could not process this video. Please try a different link.' },
                502,
                rateHeaders
            );
        }

        const data = await response.json();
        return jsonResponse(data, 200, rateHeaders);

    } catch (error) {
        console.error('Function error:', error.message);
        return jsonResponse({ error: 'Something went wrong. Please try again.' }, 500);
    }
}
