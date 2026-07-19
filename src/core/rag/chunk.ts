/**
 * Chunking strategy. Naive fixed-size splits cut sentences in half and wreck
 * retrieval. We split on structure (paragraphs) first, then pack paragraphs into
 * overlapping windows so context isn't lost at boundaries.
 *
 * `contextualize` implements Anthropic's "contextual retrieval": prepend a short
 * doc-level header to each chunk BEFORE embedding, which sharply cuts retrieval
 * misses on ambiguous chunks. Worth knowing — it's a cheap, big win.
 */
export interface ChunkOptions {
  maxChars?: number;
  overlap?: number;
}

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const maxChars = opts.maxChars ?? 1200;
  const overlap = opts.overlap ?? 150;
  const paragraphs = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";
  for (const para of paragraphs) {
    if (current.length + para.length + 2 > maxChars && current.length > 0) {
      chunks.push(current.trim());
      // carry overlap from the tail of the previous chunk
      current = current.slice(Math.max(0, current.length - overlap)) + "\n\n" + para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

/** Prepend doc context to a chunk before embedding (contextual retrieval). */
export function contextualize(docTitle: string | undefined, chunk: string): string {
  return docTitle ? `[Document: ${docTitle}]\n${chunk}` : chunk;
}
