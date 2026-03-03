import { Queue } from "bullmq";
import IORedis from "ioredis";
import { config } from "./config.js";

export const redis = new IORedis(config.redisUrl, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false
});

export const jobsQueue = new Queue(config.jobQueueName, {
    connection: redis
});
