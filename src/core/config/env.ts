import "dotenv/config";
import { z } from "zod";

/**
 * Single source of truth for configuration. Every env var is validated at
 * boot — the app refuses to start with a bad config instead of failing
 * mysteriously at runtime. This is a senior-engineer reflex: fail loud, fail early.
 */
const schema = z.object({
  // Models
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  OLLAMA_BASE_URL: z.string().url().default("http://localhost:11434/v1"),

  MODEL_LOCAL: z.string().default("qwen2.5:7b"),
  MODEL_LOCAL_FAST: z.string().default("llama3.2:3b"),
  MODEL_EMBED: z.string().default("nomic-embed-text"),
  MODEL_OPEN: z.string().default("z-ai/glm-4.6"),
  MODEL_FRONTIER: z.string().default("claude-sonnet-4-6"),
  MODEL_FRONTIER_HARD: z.string().default("claude-opus-4-8"),

  // Data
  DATABASE_URL: z.string().url().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),

  // Observability
  LANGFUSE_BASE_URL: z.string().url().optional(),
  LANGFUSE_PUBLIC_KEY: z.string().optional(),
  LANGFUSE_SECRET_KEY: z.string().optional(),

  // Runtime
  NODE_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  PORT: z.coerce.number().int().positive().default(8080),
  MAX_RUN_BUDGET_CENTS: z.coerce.number().positive().default(25),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  // eslint-disable-next-line no-console
  console.error("❌ Invalid environment configuration:\n", z.prettifyError(parsed.error));
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;

/** True if a given tier is usable given the keys present. */
export const tierAvailable = {
  local: () => Boolean(env.OLLAMA_BASE_URL),
  open: () => Boolean(env.OPENROUTER_API_KEY),
  frontier: () => Boolean(env.ANTHROPIC_API_KEY),
};
