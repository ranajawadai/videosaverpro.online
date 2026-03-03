import { spawn } from "child_process";
import { config } from "./config.js";

function runYtDlpJson(url) {
    return new Promise((resolve, reject) => {
        const args = [
            "--dump-single-json",
            "--no-warnings",
            "--skip-download",
            url
        ];
        const child = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] });
        let stdout = "";
        let stderr = "";
        const timer = setTimeout(() => {
            child.kill("SIGKILL");
            reject(new Error("yt-dlp timeout"));
        }, config.ytDlpTimeoutMs);

        child.stdout.on("data", (d) => { stdout += d.toString(); });
        child.stderr.on("data", (d) => { stderr += d.toString(); });
        child.on("error", (err) => {
            clearTimeout(timer);
            reject(err);
        });
        child.on("close", (code) => {
            clearTimeout(timer);
            if (code !== 0) {
                reject(new Error(`yt-dlp failed: ${stderr || `exit ${code}`}`));
                return;
            }
            try {
                resolve(JSON.parse(stdout));
            } catch {
                reject(new Error("invalid yt-dlp json"));
            }
        });
    });
}

function mapQualities(formats = []) {
    const set = new Map();
    for (const f of formats) {
        if (!f || !f.vcodec || f.vcodec === "none") continue;
        if (!f.url) continue;
        const ext = f.ext || "mp4";
        const h = Number(f.height || 0);
        const label = h > 0 ? `${h}p` : "best";
        const key = `${label}-${ext}`;
        if (!set.has(key)) {
            set.set(key, {
                label,
                format: ext,
                filesize_estimate: f.filesize || f.filesize_approx || null
            });
        }
    }
    return Array.from(set.values()).sort((a, b) => {
        const ah = Number((a.label || "").replace("p", "")) || 0;
        const bh = Number((b.label || "").replace("p", "")) || 0;
        return bh - ah;
    }).slice(0, 8);
}

export async function inspectWithYtDlp(url, platform) {
    const meta = await runYtDlpJson(url);
    return {
        platform,
        title: meta.title || `Preview for ${platform}`,
        thumbnail_url: meta.thumbnail || "https://www.videosaverpro.online/og-image.png",
        duration_seconds: Number(meta.duration || 0) || null,
        is_playlist: !!(meta._type === "playlist" || Array.isArray(meta.entries)),
        qualities: mapQualities(meta.formats || [])
    };
}

