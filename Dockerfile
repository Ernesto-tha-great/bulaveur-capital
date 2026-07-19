# Production image for the VPS. Runs the agent service via tsx (no build step).
FROM node:22-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable
WORKDIR /app

# Install deps first for layer caching.
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# App source + generated Prisma client.
COPY . .
RUN pnpm exec prisma generate

ENV NODE_ENV=production
EXPOSE 8080

# Single process runs API + scheduler + mission worker (see src/index.ts).
# For higher load, split into `web` (pnpm start) and `worker` (pnpm worker) services.
CMD ["pnpm", "start"]
