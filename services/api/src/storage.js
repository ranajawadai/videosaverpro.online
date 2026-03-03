import crypto from "crypto";
import { config } from "./config.js";

function sign(key, exp) {
    const secret = process.env.SIGNED_URL_SECRET || "dev_secret";
    return crypto.createHmac("sha256", secret).update(`${key}.${exp}`).digest("hex");
}

export function createSignedFileUrl(storageKey) {
    const exp = Math.floor(Date.now() / 1000) + config.signedUrlTtlSeconds;
    const sig = sign(storageKey, exp);
    return `${config.apiBaseUrl}/v1/files/stream?key=${encodeURIComponent(storageKey)}&exp=${exp}&sig=${sig}`;
}

export function validateSignedFileUrl(key, exp, sig) {
    const now = Math.floor(Date.now() / 1000);
    if (!key || !exp || !sig) return false;
    if (Number(exp) < now) return false;
    const expected = sign(key, exp);
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
}

