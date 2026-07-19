import { PrismaClient } from "@prisma/client";
import { env } from "./config/env";

/**
 * One PrismaClient for the process. Postgres + pgvector is our system of record:
 * documents, embeddings, agent runs, approvals, publications, and domain data.
 */
export const prisma = new PrismaClient({
  log: env.LOG_LEVEL === "debug" ? ["warn", "error"] : ["error"],
});
