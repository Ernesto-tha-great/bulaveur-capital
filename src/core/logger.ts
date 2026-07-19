import pino from "pino";
import { env } from "./config/env";

/**
 * Structured logger. In dev it pretty-prints; in prod it emits JSON lines
 * that your VPS log shipper / Langfuse can consume.
 */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true, translateTime: "HH:MM:ss" } }
      : undefined,
});

export type Logger = typeof logger;
