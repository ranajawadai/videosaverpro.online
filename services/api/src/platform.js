import { supportedPlatforms } from "./config.js";

export function detectPlatform(url) {
    try {
        const u = new URL(url);
        const host = u.hostname.toLowerCase();
        const match = supportedPlatforms.find((d) => host === d || host.endsWith(`.${d}`));
        if (!match) return null;
        return match.replace("www.", "");
    } catch {
        return null;
    }
}

export function buildPreview(url, platform) {
    return {
        platform,
        title: `Preview for ${platform} link`,
        thumbnail_url: "https://www.videosaverpro.online/og-image.png",
        duration_seconds: null,
        is_playlist: /list=|playlist/i.test(url),
        qualities: [
            { label: "720p", format: "mp4", filesize_estimate: null },
            { label: "1080p", format: "mp4", filesize_estimate: null }
        ]
    };
}

export function normalizeUrl(input) {
    const url = new URL(input);
    url.hash = "";
    return url.toString();
}
