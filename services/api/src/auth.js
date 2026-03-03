import { config } from "./config.js";

export function authPreHandler(req, reply, done) {
    if (!config.requireApiKey) return done();
    const apiKey = req.headers["x-api-key"];
    if (!apiKey || apiKey !== config.serviceApiKey) {
        reply.code(401).send({ error: "invalid API key" });
        return;
    }
    done();
}

