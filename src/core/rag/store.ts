import { createHash } from "node:crypto";
import { prisma } from "../db";
import { logger } from "../logger";
import { chunkText, contextualize } from "./chunk";
import { embedTexts, toVectorLiteral } from "./embed";

/**
 * Ingest a document: dedupe by content hash, chunk, embed (contextualized), and
 * store vectors in pgvector. Embeddings are written via raw SQL because Prisma
 * has no native `vector` type yet (the column is `Unsupported("vector(768)")`).
 */
export interface IngestInput {
  source: string;
  url?: string;
  title?: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export async function ingestDocument(input: IngestInput) {
  const hash = createHash("sha256").update(input.content).digest("hex");
  const existing = await prisma.document.findUnique({ where: { hash } });
  if (existing) {
    logger.debug({ doc: existing.id, title: input.title }, "ingest.skip.duplicate");
    return existing;
  }

  const doc = await prisma.document.create({
    data: {
      source: input.source,
      url: input.url,
      title: input.title,
      content: input.content,
      hash,
      metadata: (input.metadata ?? {}) as never,
    },
  });

  const chunks = chunkText(input.content);
  const embeddings = await embedTexts(chunks.map((c) => contextualize(input.title, c)));

  for (let i = 0; i < chunks.length; i++) {
    const chunk = await prisma.chunk.create({
      data: { documentId: doc.id, idx: i, content: chunks[i]! },
    });
    const literal = toVectorLiteral(embeddings[i]!);
    await prisma.$executeRaw`UPDATE "Chunk" SET embedding = ${literal}::vector WHERE id = ${chunk.id}`;
  }

  logger.info({ doc: doc.id, chunks: chunks.length, title: input.title }, "ingest.done");
  return doc;
}
