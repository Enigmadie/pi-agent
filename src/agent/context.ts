import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppConfig } from "../config.js";

const CONTEXT_FILES = ["profile.md", "pi5-context.md", "allowed-actions.md"];

export async function loadStaticContext(config: AppConfig): Promise<string> {
  const parts = await Promise.all(
    CONTEXT_FILES.map(async (fileName) => {
      try {
        const content = await readFile(join(config.AGENT_MEMORY_DIR, fileName), "utf8");
        return `# ${fileName}\n${content}`;
      } catch {
        return "";
      }
    }),
  );

  return parts.filter(Boolean).join("\n\n");
}
