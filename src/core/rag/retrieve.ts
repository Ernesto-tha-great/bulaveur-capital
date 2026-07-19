import { prisma } from "../db";
import { routedGenerateObject } from "../models/model-router";
import { z } from "zod";
import { embedText, toVectorLiteral } from "./embed";

/**
 * Retrieval. Start with vector similarity (cosine via pgvector `<=>`), then
 * optionally LLM-rerank the top-k for precision. Hybrid keyword+vector fusion is
 * the next upgrade (see docs/ROADMAP.md) — vector-only is a fine starting point.
 */
export interface RetrievedChunk {
  id: string;
  documentId: string;
  content: string;
  score: number;
}

export async function retrieve(query: string, k = 6): Promise<RetrievedChunk[]> {
  const qvec = toVectorLiteral(await embedText(query));
  // 1 - cosine_distance = cosine_similarity (higher is better).
  const rows = await prisma.$queryRaw<RetrievedChunk[]>`
    SELECT id, "documentId", content, 1 - (embedding <=> ${qvec}::vector) AS score
    FROM "Chunk"
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${qvec}::vector
    LIMIT ${k}`;
  return rows;
}

/**
 * Keyword search via Postgres full-text (plainto_tsquery is injection-safe).
 * Complements vector search on exact terms (issuer names, tickers, defined phrases).
 */
export async function keywordSearch(query: string, k = 8): Promise<RetrievedChunk[]> {
  return prisma.$queryRaw<RetrievedChunk[]>`
    SELECT id, "documentId", content,
           ts_rank(to_tsvector('english', content), plainto_tsquery('english', ${query})) AS score
    FROM "Chunk"
    WHERE to_tsvector('english', content) @@ plainto_tsquery('english', ${query})
    ORDER BY score DESC
    LIMIT ${k}`;
}

/**
 * Hybrid retrieval: fuse vector + keyword results with Reciprocal Rank Fusion
 * (RRF, k=60). More robust than either alone — the standard production default.
 */
export async function hybridRetrieve(query: string, k = 8): Promise<RetrievedChunk[]> {
  const [vec, kw] = await Promise.all([
    retrieve(query, k).catch(() => [] as RetrievedChunk[]),
    keywordSearch(query, k).catch(() => [] as RetrievedChunk[]),
  ]);
  const fused = new Map<string, { chunk: RetrievedChunk; score: number }>();
  const add = (list: RetrievedChunk[]) =>
    list.forEach((c, i) => {
      const rr = 1 / (60 + i + 1);
      const prev = fused.get(c.id);
      if (prev) prev.score += rr;
      else fused.set(c.id, { chunk: c, score: rr });
    });
  add(vec);
  add(kw);
  return [...fused.values()]
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map((f) => ({ ...f.chunk, score: f.score }));
}

/** LLM rerank: ask a cheap model to order chunks by relevance to the query. */
export async function rerank(query: string, chunks: RetrievedChunk[], top = 4): Promise<RetrievedChunk[]> {
  if (chunks.length <= top) return chunks;
  const { object } = await routedGenerateObject({
    task: { capability: "reasoning", complexity: "medium", label: "rerank" },
    schema: z.object({ orderedIds: z.array(z.string()) }),
    prompt:
      `Query: ${query}\n\nRank these passages by relevance (most first). ` +
      `Return ordered ids.\n\n` +
      chunks.map((c) => `id=${c.id}: ${c.content.slice(0, 400)}`).join("\n---\n"),
  });
  const byId = new Map(chunks.map((c) => [c.id, c]));
  const ordered = object.orderedIds.map((id) => byId.get(id)).filter((c): c is RetrievedChunk => Boolean(c));
  return (ordered.length ? ordered : chunks).slice(0, top);
}
