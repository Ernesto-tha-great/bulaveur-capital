import { ingestDocument } from "../rag/store";
import { retrieve } from "../rag/retrieve";

/**
 * Two-tier memory:
 *  - short-term: the running message/notes buffer for a single run (in-process).
 *  - long-term: durable, searchable memory backed by the RAG vector store, so an
 *    agent can recall "what did we decide about issuer X last week".
 */
export class ShortTermMemory {
  private notes: string[] = [];
  add(note: string): void {
    this.notes.push(note);
  }
  recentDigest(maxChars = 2000): string {
    const joined = this.notes.join("\n");
    return joined.length > maxChars ? joined.slice(joined.length - maxChars) : joined;
  }
  clear(): void {
    this.notes = [];
  }
}

export const longTermMemory = {
  /** Persist a durable memory (decision, summary, learned fact). */
  async remember(text: string, meta?: Record<string, unknown>): Promise<void> {
    await ingestDocument({ source: "memory", title: "memory", content: text, metadata: meta });
  },
  /** Recall the most relevant memories for a query. */
  async recall(query: string, k = 4): Promise<string[]> {
    const hits = await retrieve(query, k);
    return hits.map((h) => h.content);
  },
};
