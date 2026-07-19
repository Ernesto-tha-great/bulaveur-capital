import { tool, type Tool, type ToolSet } from "ai";
import type { z } from "zod";

/**
 * Tools are how agents touch the world: search the web, query a DB, post to X,
 * run a calculation. We wrap the AI-SDK `tool()` with metadata the rest of the
 * system needs — chiefly `requiresApproval`, which forces high-stakes actions
 * (publish, submit, spend money) through the human-in-the-loop gate.
 */
export interface ToolMeta {
  name: string;
  description: string;
  /** High-stakes side effects must be approved before execution. */
  requiresApproval?: boolean;
  tags?: string[];
}

export interface RegisteredTool {
  meta: ToolMeta;
  tool: Tool;
}

/** Define a typed tool with a Zod input schema and an async executor. */
export function defineTool<I>(
  meta: ToolMeta,
  inputSchema: z.ZodType<I>,
  execute: (input: I) => Promise<unknown> | unknown,
): RegisteredTool {
  return {
    meta,
    tool: tool({
      description: meta.description,
      inputSchema,
      execute: async (input) => execute(input as I),
    }),
  };
}

/**
 * A registry the agent hands to the model. Also answers "does this tool need
 * approval?" so the orchestrator can pause for sign-off.
 */
export class ToolRegistry {
  private readonly tools = new Map<string, RegisteredTool>();

  register(...toolsToAdd: RegisteredTool[]): this {
    for (const t of toolsToAdd) this.tools.set(t.meta.name, t);
    return this;
  }

  /** The `ToolSet` shape the AI SDK expects: { name: Tool }. */
  toolSet(): ToolSet {
    const set: ToolSet = {};
    for (const [name, t] of this.tools) set[name] = t.tool;
    return set;
  }

  requiresApproval(name: string): boolean {
    return this.tools.get(name)?.meta.requiresApproval ?? false;
  }

  list(): ToolMeta[] {
    return [...this.tools.values()].map((t) => t.meta);
  }
}
