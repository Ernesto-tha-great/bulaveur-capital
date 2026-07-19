import { embed, embedMany } from "ai";
import { getEmbeddingModel } from "../models/providers";

/**
 * Embeddings via the LOCAL model (nomic-embed-text, 768-dim). Free + private —
 * text never leaves your machine to be embedded. This is the backbone of RAG.
 */
export async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({ model: getEmbeddingModel(), value: text });
  return embedding;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const { embeddings } = await embedMany({ model: getEmbeddingModel(), values: texts });
  return embeddings;
}

/** pgvector literal: a number[] becomes "[0.1,0.2,...]" for `::vector` casts. */
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
