import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join, normalize, relative } from "node:path";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { DatabaseClient } from "../db/client.js";
import { createLoggedTool, type RegisteredTool } from "./registry.js";

export const MEMORY_APPEND_ACTION = "memory.append";

const memoryAppendSchema = z.object({
  path: z
    .string()
    .min(1)
    .describe("Allowed path relative to AGENT_MEMORY_DIR, e.g. pi5-context.md or runbooks/agent-backlog.md"),
  content: z.string().min(1).max(4_000).describe("Markdown content to append after user confirmation"),
  reason: z.string().min(1).max(500).describe("Why this memory update is useful"),
});

export function createMemoryTools(
  config: AppConfig,
  db: DatabaseClient,
): Record<string, RegisteredTool> {
  return {
    memory_propose_append: createLoggedTool({
      name: "memory_propose_append",
      description:
        "Propose appending public-safe markdown to an allowlisted memory file. This creates a pending approval and does not write until the user confirms.",
      inputSchema: memoryAppendSchema,
      risk: "write",
      db,
      execute: async ({ path, content, reason }) => {
        const safePath = validateMemoryPath(path);
        validateMemoryContent(content);

        const id = randomUUID();
        await db.createApproval({
          id,
          action: MEMORY_APPEND_ACTION,
          payload: JSON.stringify({ path: safePath, content, reason }),
        });

        return {
          approvalId: id,
          path: safePath,
          reason,
          preview: content,
          message: `Предлагаю дописать в memory/${safePath}. Ответь "да" или "подтверждаю", чтобы применить.`,
        };
      },
    }),
  };
}

export async function appendApprovedMemory(config: AppConfig, input: { path: string; content: string }): Promise<void> {
  const safePath = validateMemoryPath(input.path);
  validateMemoryContent(input.content);

  const fullPath = resolveMemoryPath(config, safePath);
  await mkdir(dirname(fullPath), { recursive: true });

  const existing = await readFile(fullPath, "utf8").catch(() => "");
  const prefix = existing.endsWith("\n") || existing.length === 0 ? "" : "\n";
  await appendFile(fullPath, `${prefix}\n${input.content.trim()}\n`, "utf8");
}

function resolveMemoryPath(config: AppConfig, safePath: string): string {
  const root = normalize(config.AGENT_MEMORY_DIR);
  const fullPath = normalize(join(root, safePath));
  const rel = relative(root, fullPath);

  if (rel.startsWith("..") || rel === ".." || rel.startsWith("/")) {
    throw new Error("Memory path escapes AGENT_MEMORY_DIR");
  }

  return fullPath;
}

function validateMemoryPath(path: string): string {
  const normalized = normalize(path).replace(/^\/+/, "");

  if (normalized === "profile.md" || normalized === "pi5-context.md" || normalized === "allowed-actions.md") {
    return normalized;
  }

  if (/^runbooks\/[a-zA-Z0-9_.-]+\.md$/.test(normalized)) {
    return normalized;
  }

  throw new Error(`Memory file is not allowlisted: ${path}`);
}

function validateMemoryContent(content: string): void {
  const forbidden = [
    /OPENAI_API_KEY/i,
    /TELEGRAM_BOT_TOKEN/i,
    /PrivateKey\s*=/i,
    /PresharedKey\s*=/i,
    /sk-[a-zA-Z0-9_-]{20,}/,
    /\b\d{8,}:[a-zA-Z0-9_-]{20,}\b/,
  ];

  if (forbidden.some((pattern) => pattern.test(content))) {
    throw new Error("Memory content looks like it contains a secret; refusing to propose update");
  }
}
