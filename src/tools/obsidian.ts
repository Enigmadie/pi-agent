import { access, readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";
import { z } from "zod";
import type { AppConfig } from "../config.js";
import type { DatabaseClient } from "../db/client.js";
import { createLoggedTool, type RegisteredTool } from "./registry.js";

const searchSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(20).default(10),
});

const readNoteSchema = z.object({
  path: z.string().min(1).describe("Path relative to the Obsidian vault"),
});

async function listMarkdownFiles(root: string): Promise<string[]> {
  await access(root);

  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(root, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".obsidian" || entry.name === ".git") {
          return [];
        }
        return listMarkdownFiles(path);
      }
      return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
    }),
  );

  return files.flat();
}

export function createObsidianTools(
  config: AppConfig,
  db: DatabaseClient,
): Record<string, RegisteredTool> {
  return {
    obsidian_search: createLoggedTool({
      name: "obsidian_search",
      description: "Search markdown files in the configured Obsidian vault by case-insensitive substring.",
      inputSchema: searchSchema,
      risk: "read",
      db,
      execute: async ({ query, limit }) => {
        let files: string[];
        try {
          files = await listMarkdownFiles(config.OBSIDIAN_VAULT_PATH);
        } catch {
          return {
            error: "Notes directory is not available on this machine",
            path: config.OBSIDIAN_VAULT_PATH,
            hint: "Sync notes to this path or keep essential context in memory/.",
          };
        }

        const normalizedQuery = query.toLowerCase();
        const matches: Array<{ path: string; line: number; text: string }> = [];

        for (const file of files) {
          const content = await readFile(file, "utf8");
          const lines = content.split("\n");
          for (const [index, line] of lines.entries()) {
            if (line.toLowerCase().includes(normalizedQuery)) {
              matches.push({ path: relative(config.OBSIDIAN_VAULT_PATH, file), line: index + 1, text: line });
              if (matches.length >= limit) {
                return matches;
              }
            }
          }
        }

        return matches;
      },
    }),
    obsidian_read_note: createLoggedTool({
      name: "obsidian_read_note",
      description: "Read a markdown note by path relative to the configured Obsidian vault.",
      inputSchema: readNoteSchema,
      risk: "read",
      db,
      execute: async ({ path }) => {
        const fullPath = join(config.OBSIDIAN_VAULT_PATH, path);
        let info;
        try {
          info = await stat(fullPath);
        } catch {
          return {
            error: "Note is not available on this machine",
            path,
            root: config.OBSIDIAN_VAULT_PATH,
            hint: "Sync notes to this path or keep essential context in memory/.",
          };
        }

        if (!info.isFile() || !fullPath.endsWith(".md")) {
          throw new Error("Only markdown files can be read");
        }

        const content = await readFile(fullPath, "utf8");
        return { path, content };
      },
    }),
  };
}
