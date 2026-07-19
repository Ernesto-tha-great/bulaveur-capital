import { Queue, Worker, type ConnectionOptions, type Processor } from "bullmq";
import { env } from "../config/env";

/**
 * BullMQ on Redis is our durable-execution backbone: long agent jobs survive
 * restarts, retry on failure, and run on a schedule. This is what turns "a script
 * I run by hand" into "a product that operates itself daily."
 *
 * We hand BullMQ connection *options* (parsed from REDIS_URL) rather than our own
 * ioredis instance, so BullMQ manages the client with its own bundled ioredis.
 */
const redisUrl = new URL(env.REDIS_URL);
export const connection: ConnectionOptions = {
  host: redisUrl.hostname,
  port: Number(redisUrl.port || 6379),
  username: redisUrl.username || undefined,
  password: redisUrl.password || undefined,
  maxRetriesPerRequest: null, // required by BullMQ
};

export function makeQueue(name: string): Queue {
  return new Queue(name, { connection });
}

export function makeWorker(name: string, processor: Processor): Worker {
  return new Worker(name, processor, {
    connection,
    concurrency: 2, // gentle on a 16GB Mac / small VPS
  });
}
