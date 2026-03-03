import { spawn } from "child_process";

function runYtDlpJson(url, timeoutMs = 45000) {
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
        }, timeoutMs);

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

function selectBestMediaFormat(meta, wantedQuality = "1080p", wantedFormat = "mp4") {
    const formats = Array.isArray(meta.formats) ? meta.formats : [];
    const targetHeight = Number(String(wantedQuality).replace("p", "")) || 1080;

    // Prefer progressive formats (video + audio in one URL) to avoid silent output.
    const progressive = formats.filter((f) =>
        f &&
        f.url &&
        f.vcodec &&
        f.vcodec !== "none" &&
        f.acodec &&
        f.acodec !== "none" &&
        (!wantedFormat || f.ext === wantedFormat)
    );

    const candidates = progressive.length ? progressive : formats.filter((f) =>
        f && f.url && f.vcodec && f.vcodec !== "none"
    );

    if (!candidates.length) return formats.find((f) => f?.url) || null;

    candidates.sort((a, b) => {
        const ah = Number(a.height || 0);
        const bh = Number(b.height || 0);
        const ad = Math.abs(ah - targetHeight);
        const bd = Math.abs(bh - targetHeight);
        if (ad !== bd) return ad - bd;
        return bh - ah;
    });

    return candidates[0] || null;
}

export async function resolveJobMedia(url, quality, format) {
    const meta = await runYtDlpJson(url, Number(process.env.YTDLP_TIMEOUT_MS || 45000));
    const selected = selectBestMediaFormat(meta, quality, format);
    const height = Number(selected?.height || 0);
    const qualityLabel = height > 0 ? `${height}p MP4` : "Best Available MP4";
    const hasAudio = Boolean(selected?.acodec && selected.acodec !== "none");
    return {
        title: meta.title || "Download ready",
        thumbnail: meta.thumbnail || "https://www.videosaverpro.online/og-image.png",
        mediaUrl: selected?.url || null,
        qualityLabel,
        hasAudio
    };
}
