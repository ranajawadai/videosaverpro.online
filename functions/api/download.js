// Legacy endpoint intentionally deprecated.
// The application now uses self-hosted API endpoints at /v1/*
// via api.videosaverpro.online (Cloudflare Worker gateway + Railway services).

function jsonResponse(data, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "https://www.videosaverpro.online",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type"
        }
    });
}

export async function onRequestOptions() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "https://www.videosaverpro.online",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type",
            "Access-Control-Max-Age": "86400"
        }
    });
}

export async function onRequestPost() {
    return jsonResponse(
        {
            error: "Legacy endpoint removed. Use self-hosted API flow: /v1/link/inspect -> /v1/jobs -> /v1/jobs/{id}/files."
        },
        410
    );
}
